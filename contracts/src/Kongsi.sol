// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title Kongsi: tokenisasi effort berbasis bukti (milestone) dengan lapisan bukti Jejak.
/// @notice Satu kontrak menampung semua effort. Token effort dicatat sebagai saldo internal
///         (bukan ERC20) dan hanya berpindah lewat pasar sekunder (listing).
contract Kongsi {
    // ───────────────────────────── tipe ─────────────────────────────

    enum Status {
        Selling, // penjualan awal, belum sold out
        Running, // sold out, effort berjalan
        Completed, // semua milestone terverifikasi
        Failed // tenggat terlewat / ditolak: token hangus, refund
    }

    enum MState {
        Pending,
        Submitted, // bukti diunggah, menunggu voting
        Verified,
        Rejected
    }

    struct Effort {
        address owner;
        string metadataURI;
        uint256 totalValue; // nilai tokenisasi (kebutuhan biaya operasional)
        uint256 maxYield; // batas total hasil yang dibagikan
        uint256 tokenSupply;
        uint256 tokenPrice; // harga penjualan awal per token
        uint64 saleDeadline;
        uint256 sold;
        Status status;
        uint16 releasedBps; // porsi dana yang sudah dicairkan ke pemilik
        uint256 verifiedCount;
        uint256 revenueGross;
        uint256 payoutPool;
        bool revenueDeposited;
    }

    struct Milestone {
        uint64 deadline;
        uint16 weightBps;
        MState state;
        string evidenceCid; // CID IPFS bukti (Jejak)
        bytes32 evidenceHash; // keccak256 file bukti
        uint64 snapshotBlock;
        uint256 yes;
        uint256 no;
    }

    struct Listing {
        uint256 effortId;
        address seller;
        uint256 amount;
        uint256 pricePerToken;
        bool active;
    }

    struct Checkpoint {
        uint64 blockNumber;
        uint192 amount;
    }

    // ───────────────────────────── state ─────────────────────────────

    uint16 public constant BPS = 10_000;

    IERC20 public immutable idr;

    uint256 public effortCount;
    uint256 public listingCount;

    mapping(uint256 => Effort) private _efforts;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(uint256 => mapping(address => Checkpoint[])) private _checkpoints;
    mapping(uint256 => mapping(address => uint256)) public lockedBalance;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public refunded;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => Listing) public listings;

    // ───────────────────────────── events ─────────────────────────────

    event EffortCreated(uint256 indexed id, address indexed owner, string metadataURI, uint256 totalValue, uint256 tokenSupply);
    event TokensBought(uint256 indexed id, address indexed buyer, uint256 amount, uint256 cost);
    event EffortStarted(uint256 indexed id, uint256 releasedAmount);
    event EvidenceSubmitted(uint256 indexed id, uint256 indexed milestone, string cid, bytes32 hash);
    event Voted(uint256 indexed id, uint256 indexed milestone, address indexed voter, bool approve, uint256 weight);
    event MilestoneVerified(uint256 indexed id, uint256 indexed milestone, uint256 releasedAmount);
    event MilestoneRejected(uint256 indexed id, uint256 indexed milestone);
    event EffortCompleted(uint256 indexed id);
    event EffortFailed(uint256 indexed id);
    event Listed(uint256 indexed listingId, uint256 indexed id, address indexed seller, uint256 amount, uint256 pricePerToken);
    event ListingCancelled(uint256 indexed listingId);
    event ListingFilled(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 cost);
    event Refunded(uint256 indexed id, address indexed holder, uint256 amount);
    event RevenueDeposited(uint256 indexed id, uint256 gross, uint256 pool);
    event YieldClaimed(uint256 indexed id, address indexed holder, uint256 amount);

    constructor(address idr_) {
        idr = IERC20(idr_);
    }

    // ───────────────────────────── pemilik ─────────────────────────────

    /// @param deadlines tenggat tiap milestone (timestamp), harus > block.timestamp
    /// @param weightsBps bobot pencairan dana tiap milestone, total 10000. Milestone pertama dicairkan saat sold out.
    function createEffort(
        string calldata metadataURI,
        uint256 totalValue,
        uint256 maxYield,
        uint256 tokenSupply,
        uint64 saleDeadline,
        uint64[] calldata deadlines,
        uint16[] calldata weightsBps
    ) external returns (uint256 id) {
        require(tokenSupply > 0 && totalValue > 0, "nilai kosong");
        require(totalValue % tokenSupply == 0, "harga token harus bulat");
        require(maxYield >= totalValue, "max yield < tokenisasi");
        require(saleDeadline > block.timestamp, "tenggat penjualan");
        uint256 n = deadlines.length;
        require(n >= 2 && n == weightsBps.length, "milestone");

        uint256 sum;
        for (uint256 i; i < n; i++) {
            require(deadlines[i] > saleDeadline, "tenggat milestone");
            require(weightsBps[i] > 0, "bobot nol");
            sum += weightsBps[i];
        }
        require(sum == BPS, "bobot harus 100%");

        id = ++effortCount;
        Effort storage e = _efforts[id];
        e.owner = msg.sender;
        e.metadataURI = metadataURI;
        e.totalValue = totalValue;
        e.maxYield = maxYield;
        e.tokenSupply = tokenSupply;
        e.tokenPrice = totalValue / tokenSupply;
        e.saleDeadline = saleDeadline;

        for (uint256 i; i < n; i++) {
            Milestone storage m = _milestones[id].push();
            m.deadline = deadlines[i];
            m.weightBps = weightsBps[i];
        }
        emit EffortCreated(id, msg.sender, metadataURI, totalValue, tokenSupply);
    }

    /// @notice Pemilik mencatat bukti milestone ke Jejak (hash + CID offchain).
    function submitEvidence(uint256 id, uint256 index, string calldata cid, bytes32 hash) external {
        Effort storage e = _live(id);
        require(msg.sender == e.owner, "bukan pemilik");
        require(e.status == Status.Running, "effort tidak berjalan");
        require(index == e.verifiedCount, "urutan milestone");
        Milestone storage m = _milestones[id][index];
        require(m.state == MState.Pending, "bukan pending");
        m.evidenceCid = cid;
        m.evidenceHash = hash;
        m.state = MState.Submitted;
        m.snapshotBlock = uint64(block.number);
        emit EvidenceSubmitted(id, index, cid, hash);
    }

    /// @notice Setor hasil penjualan setelah semua milestone terverifikasi. Dibagikan maks `maxYield`.
    function depositRevenue(uint256 id, uint256 amount) external {
        Effort storage e = _efforts[id];
        require(msg.sender == e.owner, "bukan pemilik");
        require(e.status == Status.Completed, "belum selesai");
        require(!e.revenueDeposited, "sudah disetor");
        require(amount > 0, "jumlah nol");
        uint256 pool = amount > e.maxYield ? e.maxYield : amount;
        e.revenueDeposited = true;
        e.revenueGross = amount;
        e.payoutPool = pool;
        require(idr.transferFrom(msg.sender, address(this), pool), "transfer gagal");
        emit RevenueDeposited(id, amount, pool);
    }

    // ───────────────────────────── investor ─────────────────────────────

    /// @notice Beli token pada penjualan awal. Effort berjalan setelah seluruh token terjual.
    function buy(uint256 id, uint256 amount) external {
        Effort storage e = _live(id);
        require(e.status == Status.Selling, "penjualan ditutup");
        require(block.timestamp <= e.saleDeadline, "tenggat penjualan lewat");
        require(msg.sender != e.owner, "pemilik tidak boleh membeli");
        require(amount > 0 && amount <= e.tokenSupply - e.sold, "jumlah tidak valid");

        uint256 cost = amount * e.tokenPrice;
        e.sold += amount;
        _setBalance(id, msg.sender, balanceOf(id, msg.sender) + amount);
        require(idr.transferFrom(msg.sender, address(this), cost), "transfer gagal");
        emit TokensBought(id, msg.sender, amount, cost);

        if (e.sold == e.tokenSupply) {
            e.status = Status.Running;
            uint16 w = _milestones[id][0].weightBps;
            e.releasedBps = w;
            uint256 released = (e.totalValue * w) / BPS;
            require(idr.transfer(e.owner, released), "transfer gagal");
            emit EffortStarted(id, released);
        }
    }

    /// @notice Pemegang token (bobot = saldo pada snapshot) memverifikasi bukti milestone.
    function vote(uint256 id, uint256 index, bool approve) external {
        Effort storage e = _live(id);
        require(e.status == Status.Running, "effort tidak berjalan");
        Milestone storage m = _milestones[id][index];
        require(m.state == MState.Submitted, "tidak dalam voting");
        require(block.number > m.snapshotBlock, "tunggu blok berikutnya");
        require(block.timestamp <= m.deadline, "tenggat lewat");
        require(!hasVoted[id][index][msg.sender], "sudah memilih");

        uint256 w = balanceAt(id, msg.sender, m.snapshotBlock);
        require(w > 0, "tidak punya suara");
        hasVoted[id][index][msg.sender] = true;
        if (approve) m.yes += w;
        else m.no += w;
        emit Voted(id, index, msg.sender, approve, w);

        if (m.yes * 2 > e.tokenSupply) {
            m.state = MState.Verified;
            e.verifiedCount++;
            uint256 released;
            if (index > 0) {
                e.releasedBps += m.weightBps;
                released = (e.totalValue * m.weightBps) / BPS;
                require(idr.transfer(e.owner, released), "transfer gagal");
            }
            emit MilestoneVerified(id, index, released);
            if (e.verifiedCount == _milestones[id].length) {
                e.status = Status.Completed;
                emit EffortCompleted(id);
            }
        } else if (m.no * 2 >= e.tokenSupply) {
            m.state = MState.Rejected;
            e.status = Status.Failed;
            emit MilestoneRejected(id, index);
            emit EffortFailed(id);
        }
    }

    // ───────────────────────────── pasar sekunder ─────────────────────────────

    function list(uint256 id, uint256 amount, uint256 pricePerToken) external returns (uint256 listingId) {
        Effort storage e = _live(id);
        require(e.status == Status.Selling || e.status == Status.Running, "tidak bisa diperdagangkan");
        require(amount > 0 && pricePerToken > 0, "parameter");
        require(balanceOf(id, msg.sender) - lockedBalance[id][msg.sender] >= amount, "token tidak cukup");
        lockedBalance[id][msg.sender] += amount;
        listingId = ++listingCount;
        listings[listingId] = Listing(id, msg.sender, amount, pricePerToken, true);
        emit Listed(listingId, id, msg.sender, amount, pricePerToken);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active, "tidak aktif");
        require(l.seller == msg.sender, "bukan penjual");
        l.active = false;
        lockedBalance[l.effortId][l.seller] -= l.amount;
        emit ListingCancelled(listingId);
    }

    /// @notice Beli seluruh listing. Token berpindah, pembayaran langsung ke penjual.
    function fillListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active, "tidak aktif");
        Effort storage e = _live(l.effortId);
        require(e.status == Status.Selling || e.status == Status.Running, "tidak bisa diperdagangkan");
        require(msg.sender != l.seller, "listing sendiri");
        require(msg.sender != e.owner, "pemilik tidak boleh membeli");

        l.active = false;
        uint256 id = l.effortId;
        lockedBalance[id][l.seller] -= l.amount;
        _setBalance(id, l.seller, balanceOf(id, l.seller) - l.amount);
        _setBalance(id, msg.sender, balanceOf(id, msg.sender) + l.amount);

        uint256 cost = l.amount * l.pricePerToken;
        require(idr.transferFrom(msg.sender, l.seller, cost), "transfer gagal");
        emit ListingFilled(listingId, msg.sender, l.amount, cost);
    }

    // ───────────────────────────── hangus / refund / hasil ─────────────────────────────

    /// @notice Siapa pun dapat menandai effort gagal bila syarat tenggat terpenuhi.
    function markFailed(uint256 id) public {
        Effort storage e = _efforts[id];
        require(e.owner != address(0), "effort tidak ada");
        require(e.status != Status.Failed, "sudah gagal");
        require(_isExpired(id), "belum gagal");
        e.status = Status.Failed;
        emit EffortFailed(id);
    }

    /// @notice Refund bagian dana yang belum dicairkan, pro-rata jumlah token yang dipegang.
    function refund(uint256 id) external {
        Effort storage e = _efforts[id];
        require(e.owner != address(0), "effort tidak ada");
        if (e.status != Status.Failed) markFailed(id);
        require(!refunded[id][msg.sender], "sudah refund");
        uint256 n = balanceOf(id, msg.sender);
        require(n > 0, "tidak punya token");
        refunded[id][msg.sender] = true;
        uint256 amount = (n * e.tokenPrice * (BPS - e.releasedBps)) / BPS;
        require(idr.transfer(msg.sender, amount), "transfer gagal");
        emit Refunded(id, msg.sender, amount);
    }

    function claim(uint256 id) external {
        Effort storage e = _efforts[id];
        require(e.revenueDeposited, "belum ada hasil");
        require(!claimed[id][msg.sender], "sudah klaim");
        uint256 n = balanceOf(id, msg.sender);
        require(n > 0, "tidak punya token");
        claimed[id][msg.sender] = true;
        uint256 amount = (e.payoutPool * n) / e.tokenSupply;
        require(idr.transfer(msg.sender, amount), "transfer gagal");
        emit YieldClaimed(id, msg.sender, amount);
    }

    // ───────────────────────────── view ─────────────────────────────

    function getEffort(uint256 id) external view returns (Effort memory) {
        return _efforts[id];
    }

    function getMilestones(uint256 id) external view returns (Milestone[] memory) {
        return _milestones[id];
    }

    function milestoneCount(uint256 id) external view returns (uint256) {
        return _milestones[id].length;
    }

    /// @notice Status efektif, termasuk kegagalan yang belum ditandai onchain.
    function effectiveStatus(uint256 id) public view returns (Status) {
        Effort storage e = _efforts[id];
        if (e.status != Status.Failed && e.status != Status.Completed && _isExpired(id)) return Status.Failed;
        return e.status;
    }

    function balanceOf(uint256 id, address who) public view returns (uint256) {
        Checkpoint[] storage c = _checkpoints[id][who];
        return c.length == 0 ? 0 : c[c.length - 1].amount;
    }

    /// @notice Saldo pada akhir blok `blockNumber`.
    function balanceAt(uint256 id, address who, uint256 blockNumber) public view returns (uint256) {
        Checkpoint[] storage c = _checkpoints[id][who];
        uint256 lo;
        uint256 hi = c.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (c[mid].blockNumber <= blockNumber) lo = mid + 1;
            else hi = mid;
        }
        return lo == 0 ? 0 : c[lo - 1].amount;
    }

    // ───────────────────────────── internal ─────────────────────────────

    /// @dev Revert bila effort ada tetapi sudah (efektif) gagal, sehingga aksi tidak berjalan pada effort hangus.
    function _live(uint256 id) internal view returns (Effort storage e) {
        e = _efforts[id];
        require(e.owner != address(0), "effort tidak ada");
        require(e.status != Status.Failed && !_isExpired(id), "effort gagal");
    }

    function _isExpired(uint256 id) internal view returns (bool) {
        Effort storage e = _efforts[id];
        if (e.status == Status.Completed) return false;
        if (e.status == Status.Selling) return block.timestamp > e.saleDeadline;
        if (e.status == Status.Running) {
            Milestone[] storage ms = _milestones[id];
            for (uint256 i = e.verifiedCount; i < ms.length; i++) {
                if (ms[i].deadline < block.timestamp) return true;
            }
        }
        return false;
    }

    function _setBalance(uint256 id, address who, uint256 newBalance) internal {
        require(newBalance <= type(uint192).max, "overflow");
        Checkpoint[] storage c = _checkpoints[id][who];
        uint256 len = c.length;
        if (len > 0 && c[len - 1].blockNumber == block.number) {
            c[len - 1].amount = uint192(newBalance);
        } else {
            c.push(Checkpoint(uint64(block.number), uint192(newBalance)));
        }
    }
}

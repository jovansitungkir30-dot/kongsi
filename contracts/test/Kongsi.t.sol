// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Kongsi} from "../src/Kongsi.sol";
import {MockIDR} from "../src/MockIDR.sol";

contract KongsiTest is Test {
    Kongsi k;
    MockIDR idr;

    address owner = makeAddr("owner");
    address a = makeAddr("investorA");
    address b = makeAddr("investorB");
    address c = makeAddr("investorC");

    uint256 constant SUPPLY = 1000;
    uint256 constant TOTAL = 200_000_000 * 1e6; // Rp200 jt
    uint256 constant MAX_YIELD = 1_000_000_000 * 1e6; // Rp1 M
    uint256 constant PRICE = TOTAL / SUPPLY;

    uint64 saleDeadline;
    uint64[] deadlines;
    uint16[] weights;

    function setUp() public {
        idr = new MockIDR();
        k = new Kongsi(address(idr));

        saleDeadline = uint64(block.timestamp + 7 days);
        deadlines = [uint64(block.timestamp + 30 days), uint64(block.timestamp + 60 days), uint64(block.timestamp + 90 days)];
        weights = [uint16(4000), 3000, 3000];

        address[4] memory users = [owner, a, b, c];
        for (uint256 i; i < users.length; i++) {
            idr.mint(users[i], 10_000_000_000 * 1e6);
            vm.prank(users[i]);
            idr.approve(address(k), type(uint256).max);
        }
    }

    // ───── helpers ─────

    function _create() internal returns (uint256 id) {
        vm.prank(owner);
        id = k.createEffort("ipfs://meta", TOTAL, MAX_YIELD, SUPPLY, saleDeadline, deadlines, weights);
    }

    function _soldOut(uint256 id) internal {
        vm.prank(a);
        k.buy(id, 700);
        vm.prank(b);
        k.buy(id, 300);
    }

    function _submit(uint256 id, uint256 i) internal {
        vm.prank(owner);
        k.submitEvidence(id, i, "bafy-cid", keccak256("bukti"));
        vm.roll(block.number + 1);
    }

    function _verify(uint256 id, uint256 i) internal {
        _submit(id, i);
        vm.prank(a);
        k.vote(id, i, true); // a memegang 700 > 50%
    }

    // ───── penjualan awal ─────

    function test_notRunningUntilSoldOut() public {
        uint256 id = _create();
        vm.prank(a);
        k.buy(id, 700);
        assertEq(uint8(k.getEffort(id).status), uint8(Kongsi.Status.Selling));
        assertEq(idr.balanceOf(owner), 10_000_000_000 * 1e6, "belum ada dana cair");

        vm.prank(b);
        k.buy(id, 300);
        assertEq(uint8(k.getEffort(id).status), uint8(Kongsi.Status.Running));
        // milestone 1 (40%) cair saat sold out
        assertEq(idr.balanceOf(owner), 10_000_000_000 * 1e6 + (TOTAL * 4000) / 10_000);
    }

    function test_cannotBuyMoreThanRemaining() public {
        uint256 id = _create();
        vm.prank(a);
        k.buy(id, 900);
        vm.prank(b);
        vm.expectRevert("jumlah tidak valid");
        k.buy(id, 101);
    }

    function test_ownerCannotBuyOwnTokens() public {
        uint256 id = _create();
        vm.prank(owner);
        vm.expectRevert("pemilik tidak boleh membeli");
        k.buy(id, 1);
    }

    function test_refundWhenSaleDeadlinePassesWithoutSoldOut() public {
        uint256 id = _create();
        vm.prank(a);
        k.buy(id, 400);
        uint256 before = idr.balanceOf(a);

        vm.warp(saleDeadline + 1);
        vm.prank(b);
        vm.expectRevert("effort gagal");
        k.buy(id, 1);

        vm.prank(a);
        k.refund(id);
        assertEq(idr.balanceOf(a) - before, 400 * PRICE, "refund penuh");
        assertEq(uint8(k.getEffort(id).status), uint8(Kongsi.Status.Failed));
    }

    // ───── token & pasar sekunder ─────

    function test_listingAndSecondaryPurchase() public {
        uint256 id = _create();
        _soldOut(id);

        uint256 price2 = PRICE * 13 / 10;
        vm.prank(a);
        uint256 lid = k.list(id, 200, price2);

        uint256 aBefore = idr.balanceOf(a);
        vm.prank(c);
        k.fillListing(lid);

        assertEq(k.balanceOf(id, a), 500);
        assertEq(k.balanceOf(id, c), 200);
        assertEq(idr.balanceOf(a) - aBefore, 200 * price2);
        assertEq(k.lockedBalance(id, a), 0);
    }

    function test_cannotListMoreThanFreeBalance() public {
        uint256 id = _create();
        _soldOut(id);
        vm.startPrank(a);
        k.list(id, 600, PRICE);
        vm.expectRevert("token tidak cukup");
        k.list(id, 101, PRICE);
        vm.stopPrank();
    }

    function test_cancelListingUnlocks() public {
        uint256 id = _create();
        _soldOut(id);
        vm.startPrank(a);
        uint256 lid = k.list(id, 300, PRICE);
        assertEq(k.lockedBalance(id, a), 300);
        k.cancelListing(lid);
        assertEq(k.lockedBalance(id, a), 0);
        vm.stopPrank();
    }

    function test_onlySellerCancels() public {
        uint256 id = _create();
        _soldOut(id);
        vm.prank(a);
        uint256 lid = k.list(id, 10, PRICE);
        vm.prank(b);
        vm.expectRevert("bukan penjual");
        k.cancelListing(lid);
    }

    function test_noListingAfterCompleted() public {
        uint256 id = _create();
        _soldOut(id);
        _verify(id, 0);
        _verify(id, 1);
        _verify(id, 2);
        assertEq(uint8(k.getEffort(id).status), uint8(Kongsi.Status.Completed));

        vm.prank(a);
        vm.expectRevert("tidak bisa diperdagangkan");
        k.list(id, 1, PRICE);
    }

    // ───── Jejak & voting ─────

    function test_onlyOwnerSubmitsEvidence() public {
        uint256 id = _create();
        _soldOut(id);
        vm.prank(a);
        vm.expectRevert("bukan pemilik");
        k.submitEvidence(id, 0, "cid", bytes32(0));
    }

    function test_milestonesMustBeSequential() public {
        uint256 id = _create();
        _soldOut(id);
        vm.prank(owner);
        vm.expectRevert("urutan milestone");
        k.submitEvidence(id, 1, "cid", bytes32(0));
    }

    function test_voteWeightIsSnapshotAtSubmission() public {
        uint256 id = _create();
        _soldOut(id);
        _submit(id, 0);

        // a menjual semua token ke c setelah snapshot
        vm.prank(a);
        uint256 lid = k.list(id, 700, PRICE);
        vm.prank(c);
        k.fillListing(lid);
        vm.roll(block.number + 1);

        // c tidak punya suara pada milestone ini, a masih punya bobot 700
        vm.prank(c);
        vm.expectRevert("tidak punya suara");
        k.vote(id, 0, true);

        vm.prank(a);
        k.vote(id, 0, true);
        assertEq(uint8(k.getMilestones(id)[0].state), uint8(Kongsi.MState.Verified));
    }

    function test_noDoubleVote() public {
        uint256 id = _create();
        _soldOut(id);
        _submit(id, 0);
        vm.prank(b);
        k.vote(id, 0, true); // 300, belum quorum
        vm.prank(b);
        vm.expectRevert("sudah memilih");
        k.vote(id, 0, true);
    }

    function test_quorumApproveReleasesTranche() public {
        uint256 id = _create();
        _soldOut(id);
        uint256 ownerBefore = idr.balanceOf(owner);

        _submit(id, 0);
        vm.prank(b);
        k.vote(id, 0, true);
        assertEq(uint8(k.getMilestones(id)[0].state), uint8(Kongsi.MState.Submitted), "300 belum >50%");

        vm.prank(a);
        k.vote(id, 0, true);
        assertEq(uint8(k.getMilestones(id)[0].state), uint8(Kongsi.MState.Verified));
        assertEq(idr.balanceOf(owner), ownerBefore, "milestone pertama sudah cair saat sold out");

        _verify(id, 1);
        assertEq(idr.balanceOf(owner) - ownerBefore, (TOTAL * 3000) / 10_000);
        assertEq(k.getEffort(id).releasedBps, 7000);
    }

    function test_quorumRejectFailsEffortAndRefunds() public {
        uint256 id = _create();
        _soldOut(id);
        _submit(id, 0);
        vm.prank(a);
        k.vote(id, 0, false); // 700 tolak

        assertEq(uint8(k.getEffort(id).status), uint8(Kongsi.Status.Failed));
        uint256 before = idr.balanceOf(b);
        vm.prank(b);
        k.refund(id);
        // 40% sudah cair, sisa 60% dikembalikan pro-rata
        assertEq(idr.balanceOf(b) - before, 300 * PRICE * 6000 / 10_000);
    }

    // ───── hangus & refund ─────

    function test_missedMilestoneDeadlineExpiresAndRefundsSecondaryBuyer() public {
        uint256 id = _create();
        _soldOut(id);
        _verify(id, 0);

        // c membeli di pasar sekunder dari a
        vm.prank(a);
        uint256 lid = k.list(id, 100, PRICE * 2);
        vm.prank(c);
        k.fillListing(lid);

        // milestone 1 tidak diunggah sebelum tenggat
        vm.warp(deadlines[1] + 1);
        assertEq(uint8(k.effectiveStatus(id)), uint8(Kongsi.Status.Failed));

        vm.prank(owner);
        vm.expectRevert("effort gagal");
        k.submitEvidence(id, 1, "cid", bytes32(0));

        k.markFailed(id);
        assertEq(uint8(k.getEffort(id).status), uint8(Kongsi.Status.Failed));

        // refund sisa escrow: 40% cair -> 60% dikembalikan
        uint256 cBefore = idr.balanceOf(c);
        vm.prank(c);
        k.refund(id);
        assertEq(idr.balanceOf(c) - cBefore, 100 * PRICE * 6000 / 10_000);

        // tidak bisa refund dua kali
        vm.prank(c);
        vm.expectRevert("sudah refund");
        k.refund(id);
    }

    function test_refundTotalsNeverExceedEscrow() public {
        uint256 id = _create();
        _soldOut(id);
        vm.warp(deadlines[0] + 1);

        uint256 contractBefore = idr.balanceOf(address(k));
        vm.prank(a);
        k.refund(id);
        vm.prank(b);
        k.refund(id);
        uint256 left = idr.balanceOf(address(k));
        assertEq(contractBefore - left, TOTAL * 6000 / 10_000);
    }

    function test_cannotRefundActiveEffort() public {
        uint256 id = _create();
        _soldOut(id);
        vm.prank(a);
        vm.expectRevert("belum gagal");
        k.refund(id);
    }

    // ───── hasil & max yield ─────

    function _complete(uint256 id) internal {
        _soldOut(id);
        _verify(id, 0);
        _verify(id, 1);
        _verify(id, 2);
    }

    function test_payoutBelowCapIsProRata() public {
        uint256 id = _create();
        _complete(id);

        uint256 revenue = 400_000_000 * 1e6;
        vm.prank(owner);
        k.depositRevenue(id, revenue);

        uint256 aBefore = idr.balanceOf(a);
        vm.prank(a);
        k.claim(id);
        assertEq(idr.balanceOf(a) - aBefore, (revenue * 700) / SUPPLY);
    }

    function test_payoutIsCappedAtMaxYield() public {
        uint256 id = _create();
        _complete(id);

        uint256 revenue = 3_000_000_000 * 1e6; // > max yield
        uint256 ownerBefore = idr.balanceOf(owner);
        vm.prank(owner);
        k.depositRevenue(id, revenue);

        // hanya max yield yang ditarik dari pemilik, sisanya tetap miliknya
        assertEq(ownerBefore - idr.balanceOf(owner), MAX_YIELD);
        assertEq(k.getEffort(id).payoutPool, MAX_YIELD);

        uint256 aBefore = idr.balanceOf(a);
        uint256 bBefore = idr.balanceOf(b);
        vm.prank(a);
        k.claim(id);
        vm.prank(b);
        k.claim(id);
        uint256 total = (idr.balanceOf(a) - aBefore) + (idr.balanceOf(b) - bBefore);
        assertEq(total, MAX_YIELD);
    }

    function test_cannotClaimTwice() public {
        uint256 id = _create();
        _complete(id);
        vm.prank(owner);
        k.depositRevenue(id, 300_000_000 * 1e6);
        vm.startPrank(a);
        k.claim(id);
        vm.expectRevert("sudah klaim");
        k.claim(id);
        vm.stopPrank();
    }

    function test_onlyOwnerDepositsRevenue() public {
        uint256 id = _create();
        _complete(id);
        vm.prank(a);
        vm.expectRevert("bukan pemilik");
        k.depositRevenue(id, 1);
    }

    function test_cannotDepositBeforeCompleted() public {
        uint256 id = _create();
        _soldOut(id);
        vm.prank(owner);
        vm.expectRevert("belum selesai");
        k.depositRevenue(id, 1);
    }

    function test_createValidations() public {
        uint16[] memory bad = new uint16[](3);
        bad[0] = 5000;
        bad[1] = 3000;
        bad[2] = 1000;
        vm.prank(owner);
        vm.expectRevert("bobot harus 100%");
        k.createEffort("m", TOTAL, MAX_YIELD, SUPPLY, saleDeadline, deadlines, bad);
    }
}

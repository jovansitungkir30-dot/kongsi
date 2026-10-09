# Kongsi: tokenisasi effort berbasis bukti (Jejak)

Platform patungan modal: pemilik effort menokenisasi usaha bermilestone, investor membeli token,
bukti tiap milestone dicatat di **Jejak**, token bisa diperdagangkan antar investor, hasil dibagi
saat milestone akhir (dibatasi max yield), atau refund jika tenggat terlewat.

## Struktur
- `apps/web`: Next.js (App Router) + TypeScript + Tailwind, antarmuka Indonesia. Dua mode data:
  **Demo** (mock di browser) dan **Onchain** (kontrak di testnet, lewat viem + wallet).
- `contracts`: Solidity + Foundry (`Kongsi.sol`, `MockIDR.sol`, test, script deploy).

## Menjalankan mode demo
```
cd apps/web
pnpm install
pnpm dev        # http://localhost:3000
```
Ganti akun demo di topbar (Petani x, jovan, T Ronald, Investor a, Investor b).

## Test kontrak
```
cd contracts
forge test
```

## Deploy ke Sepolia dan mode onchain
```
cd contracts
cast wallet import deployer --interactive
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --account deployer
```
Salin alamat ke `apps/web/.env.local` (lihat `.env.local.example`), jalankan ulang `pnpm dev`,
lalu klik badge "Mode Demo" di topbar untuk beralih ke "Onchain · Sepolia".
Ambil `MockIDR` lewat tombol Faucet setelah wallet terhubung.

## Aturan token
- Effort berjalan hanya setelah semua token terjual; milestone pertama dicairkan saat sold out.
- Token hanya berpindah lewat listing di pasar sekunder, sampai milestone terakhir tercapai.
- Bukti diverifikasi voting pemegang token (bobot = saldo saat bukti diunggah, quorum >50%).
- Milestone tidak terpenuhi sebelum tenggat atau ditolak: token hangus, sisa dana direfund pro-rata.
- Hasil dibagi pro-rata, total dibatasi max yield; sisa tetap milik pemilik.

Catatan: setelah clone, jalankan `cd contracts && forge install foundry-rs/forge-std` sebelum `forge test`.

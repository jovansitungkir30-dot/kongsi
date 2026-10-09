import type { Effort, Milestone, State } from "./types";

const ms = (
  id: string,
  title: string,
  description: string,
  deadline: string,
  weightBps: number,
  status: Milestone["status"] = "pending",
  evidence?: Milestone["evidence"],
  extra: Partial<Milestone> = {},
): Milestone => ({
  id,
  title,
  description,
  deadline,
  weightBps,
  status,
  evidence,
  yes: 0,
  no: 0,
  voted: {},
  ...extra,
});

const ev = (fileName: string, note: string, uploadedAt: string, n: number) => ({
  fileName,
  note,
  uploadedAt,
  cid: `bafybeigdyrzt5kongsi${n.toString().padStart(4, "0")}jejakdemo`,
  hash: `0x${(n * 7919).toString(16).padStart(8, "0").repeat(8)}`,
});

const petani: Effort = {
  id: "petani-x",
  ownerId: "petani-x",
  title: "Panen 1.000 bibit padi",
  category: "Pertanian",
  summary:
    "Petani x punya lahan dan modal membeli bibit, tetapi tidak punya modal perawatan dan operasional sampai panen terjual.",
  target: "Panen dan menjual 1.000 bibit padi",
  totalValue: 200_000_000,
  maxYield: 1_000_000_000,
  tokenSupply: 1000,
  sold: 1000,
  saleDeadline: "2026-06-30T00:00:00Z",
  createdAt: "2026-06-01T00:00:00Z",
  milestones: [
    ms("m1", "Pembelian 1.000 bibit padi", "Bukti: bon pembelian bibit.", "2026-07-15T00:00:00Z", 3000, "verified",
      ev("bon-pembelian-bibit.pdf", "Bon pembelian 1.000 bibit padi dari UD Tani Makmur.", "2026-07-10T00:00:00Z", 1), { yes: 1000, snapshot: { "investor-a": 1000 }, voted: { "investor-a": true } }),
    ms("m2", "Penyiraman dan perawatan", "Dokumentasi penyiraman dan perawatan rutin.", "2026-09-01T00:00:00Z", 2500, "verified",
      ev("dokumentasi-penyiraman.jpg", "Foto penyiraman minggu 1-6.", "2026-08-25T00:00:00Z", 2), { yes: 1000, snapshot: { "investor-a": 1000 }, voted: { "investor-a": true } }),
    ms("m3", "Menghubungi penjual / pembeli", "Dokumentasi petani menghubungkan dengan pembeli.", "2026-09-30T00:00:00Z", 1000, "verified",
      ev("kontak-pembeli.jpg", "Tangkapan layar kesepakatan dengan pembeli.", "2026-09-20T00:00:00Z", 3), { yes: 1000, snapshot: { "investor-a": 1000 }, voted: { "investor-a": true } }),
    ms("m4", "Panen", "Dokumentasi hasil panen.", "2026-12-15T00:00:00Z", 2000, "submitted",
      ev("dokumentasi-panen.jpg", "Hasil panen 1.000 rumpun, tim menimbang bersama.", "2026-10-08T00:00:00Z", 4), { snapshot: { "investor-a": 1000 } }),
    ms("m5", "Penjualan hasil panen", "Bukti nota penjualan ke pembeli.", "2027-01-31T00:00:00Z", 1500),
  ],
  profile: {
    bio: "Petani padi generasi ketiga di Karawang, mengelola 2 hektare sawah beririgasi teknis.",
    location: "Karawang, Jawa Barat",
    specs: ["Lahan 2 ha (SHM, dokumen terlampir)", "Irigasi teknis", "Gudang penyimpanan 20 ton", "Anggota Gapoktan Sumber Rejeki"],
    portfolio: [
      { title: "Panen 800 rumpun padi", result: "Berhasil, terjual Rp260 jt", year: 2025 },
      { title: "Panen jagung 1 ha", result: "Berhasil, terjual Rp95 jt", year: 2024 },
    ],
  },
  trades: [
    { t: "2026-06-30T00:00:00Z", price: 200_000 },
    { t: "2026-08-26T00:00:00Z", price: 235_000 },
    { t: "2026-09-21T00:00:00Z", price: 262_000 },
  ],
  refunded: {},
  claimed: {},
};

const jovan: Effort = {
  id: "jovan-marathon",
  ownerId: "jovan",
  title: "Menang lomba lari marathon Asia Pasifik",
  category: "Atlet",
  summary: "Jovan membiayai latihan, nutrisi, dan pendaftaran lomba menuju juara marathon Asia Pasifik.",
  target: "Menjuarai marathon Asia Pasifik",
  totalValue: 100_000_000,
  maxYield: 300_000_000,
  tokenSupply: 500,
  sold: 500,
  saleDeadline: "2026-06-30T00:00:00Z",
  createdAt: "2026-06-05T00:00:00Z",
  milestones: [
    ms("m1", "Latihan", "Program latihan 12 minggu dengan pelatih.", "2026-08-15T00:00:00Z", 3000, "verified",
      ev("log-latihan.pdf", "Log latihan 12 minggu dari aplikasi lari.", "2026-08-10T00:00:00Z", 11), { yes: 500, snapshot: { "investor-a": 300, "investor-b": 200 }, voted: { "investor-a": true, "investor-b": true } }),
    ms("m2", "Makanan bergizi", "Catering nutrisi atlet.", "2026-09-10T00:00:00Z", 2000, "verified",
      ev("nota-catering.pdf", "Nota catering nutrisi 8 minggu.", "2026-09-05T00:00:00Z", 12), { yes: 500, snapshot: { "investor-a": 300, "investor-b": 200 }, voted: { "investor-a": true, "investor-b": true } }),
    ms("m3", "Daftar lomba", "Bukti pendaftaran resmi lomba. Tenggat = batas pendaftaran.", "2026-09-30T00:00:00Z", 1500),
    ms("m4", "Menang lomba", "Hasil resmi lomba (juara 1).", "2027-03-15T00:00:00Z", 3500),
  ],
  profile: {
    bio: "Pelari jarak jauh asal Bandung, peringkat 3 nasional half marathon 2025.",
    location: "Bandung, Jawa Barat",
    specs: ["Pelatih bersertifikat PASI", "PB half marathon 1:08:40", "Sponsor perlengkapan: lokal"],
    portfolio: [
      { title: "Half marathon nasional", result: "Peringkat 3", year: 2025 },
      { title: "10K Bandung Run", result: "Juara 1", year: 2024 },
    ],
  },
  trades: [{ t: "2026-06-30T00:00:00Z", price: 200_000 }],
  refunded: {},
  claimed: {},
};

const ronald: Effort = {
  id: "t-ronald",
  ownerId: "t-ronald",
  title: "Naikkan nilai diri dan usaha lewat marketing",
  category: "UMKM / Kreator",
  summary: "T Ronald menaikkan nilai diri dan usaha lewat marketing dan pengembangan diri secara terukur.",
  target: "Peningkatan omzet usaha 3x dalam 12 bulan",
  totalValue: 500_000_000,
  maxYield: 1_000_000_000,
  tokenSupply: 1000,
  sold: 400,
  saleDeadline: "2026-12-31T00:00:00Z",
  createdAt: "2026-09-20T00:00:00Z",
  milestones: [
    ms("m1", "Rebranding dan profil usaha", "Identitas visual dan profil usaha baru.", "2026-12-15T00:00:00Z", 2500),
    ms("m2", "Kampanye marketing 3 bulan", "Laporan kampanye dan metrik penjualan.", "2027-03-15T00:00:00Z", 3000),
    ms("m3", "Kursus pengembangan diri", "Sertifikat kursus bisnis dan kepemimpinan.", "2027-05-01T00:00:00Z", 2000),
    ms("m4", "Target omzet tercapai", "Laporan omzet tervalidasi.", "2027-09-30T00:00:00Z", 2500),
  ],
  profile: {
    bio: "Pelaku usaha kuliner dan konten kreator, 5 tahun membangun brand kopi lokal.",
    location: "Jakarta Selatan",
    specs: ["NIB dan NPWP usaha", "3 gerai aktif", "120 rb pengikut media sosial"],
    portfolio: [{ title: "Peluncuran produk kopi botol", result: "Berhasil, omzet naik 40%", year: 2025 }],
  },
  trades: [{ t: "2026-09-25T00:00:00Z", price: 500_000 }],
  refunded: {},
  claimed: {},
};

export function seedState(): State {
  return {
    me: "investor-b",
    users: {
      "petani-x": { id: "petani-x", name: "Petani x", role: "Pemilik effort", balance: 40_000_000 },
      jovan: { id: "jovan", name: "jovan", role: "Pemilik effort", balance: 20_000_000 },
      "t-ronald": { id: "t-ronald", name: "T Ronald", role: "Pemilik effort", balance: 0 },
      "investor-a": { id: "investor-a", name: "Investor a", role: "Investor", balance: 500_000_000 },
      "investor-b": { id: "investor-b", name: "Investor b", role: "Investor", balance: 300_000_000 },
    },
    efforts: [petani, jovan, ronald],
    listings: [
      {
        id: "l1",
        effortId: "petani-x",
        seller: "investor-a",
        amount: 300,
        price: 265_000,
        active: true,
        createdAt: "2026-10-05T00:00:00Z",
      },
    ],
    holdings: {
      "petani-x": { "investor-a": 1000 },
      "jovan-marathon": { "investor-a": 300, "investor-b": 200 },
      "t-ronald": { "investor-a": 400 },
    },
  };
}

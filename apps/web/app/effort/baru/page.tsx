"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { rupiah } from "@/lib/format";

interface Row {
  title: string;
  description: string;
  deadline: string;
  weight: number;
}

const blank = (): Row => ({ title: "", description: "", deadline: "", weight: 0 });

export default function BuatEffortPage() {
  const { state, createEffort } = useStore();
  const router = useRouter();
  const [f, setF] = useState({
    title: "",
    category: "",
    summary: "",
    target: "",
    totalValue: 100_000_000,
    maxYield: 500_000_000,
    tokenSupply: 1000,
    saleDeadline: "",
    bio: "",
    location: "",
    specs: "",
  });
  const [rows, setRows] = useState<Row[]>([
    { ...blank(), weight: 40 },
    { ...blank(), weight: 60 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const totalW = rows.reduce((n, r) => n + r.weight, 0);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (rows.some((r) => !r.title.trim() || !r.deadline)) return setError("Lengkapi judul dan tenggat tiap milestone.");
    if (!f.saleDeadline) return setError("Tenggat penjualan awal wajib diisi.");
    const res = await createEffort({
      title: f.title,
      category: f.category,
      summary: f.summary,
      target: f.target,
      totalValue: f.totalValue,
      maxYield: f.maxYield,
      tokenSupply: f.tokenSupply,
      saleDeadline: f.saleDeadline,
      bio: f.bio,
      location: f.location,
      specs: f.specs.split("\n").map((s) => s.trim()).filter(Boolean),
      milestones: rows.map((r) => ({
        title: r.title,
        description: r.description,
        deadline: r.deadline,
        weightBps: Math.round(r.weight * 100),
      })),
    });
    if (!res.ok) return setError(res.msg);
    router.push(`/effort/${res.id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Buat Effort</h1>
        <p className="text-sm text-slate-600">
          Pemilik: <b>{state.users[state.me].name}</b>. Ganti akun di topbar untuk membuat sebagai pemilik lain.
        </p>
      </div>

      <section className="card space-y-4 p-4">
        <h2 className="font-bold">Data effort</h2>
        <div>
          <label className="label">Judul</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Panen 1.000 bibit padi" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Kategori</label>
            <input className="input" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Pertanian" />
          </div>
          <div>
            <label className="label">Target akhir</label>
            <input className="input" value={f.target} onChange={(e) => set("target", e.target.value)} placeholder="Panen dan menjual 1.000 bibit" />
          </div>
        </div>
        <div>
          <label className="label">Deskripsi</label>
          <textarea className="input" rows={3} value={f.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="font-bold">Tokenisasi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Total nilai tokenisasi (Rp)</label>
            <input type="number" className="input" value={f.totalValue} onChange={(e) => set("totalValue", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Max yield (Rp, batas total hasil)</label>
            <input type="number" className="input" value={f.maxYield} onChange={(e) => set("maxYield", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Jumlah token</label>
            <input type="number" className="input" value={f.tokenSupply} onChange={(e) => set("tokenSupply", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Tenggat penjualan awal</label>
            <input type="date" className="input" value={f.saleDeadline} onChange={(e) => set("saleDeadline", e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Harga per token: <b>{rupiah(f.tokenSupply ? f.totalValue / f.tokenSupply : 0)}</b>
        </p>
      </section>

      <section className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Milestone & tenggat</h2>
          <span className={`text-sm font-semibold ${totalW === 100 ? "text-emerald-700" : "text-rose-700"}`}>
            Total pencairan {totalW}%
          </span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_90px]">
              <input className="input" placeholder={`Milestone ${i + 1}`} value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} />
              <input type="date" className="input" value={r.deadline} onChange={(e) => setRow(i, { deadline: e.target.value })} />
              <input type="number" className="input" value={r.weight} onChange={(e) => setRow(i, { weight: Number(e.target.value) })} aria-label="Bobot %" />
            </div>
            <div className="flex gap-2">
              <input className="input" placeholder="Bukti yang akan diunggah" value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} />
              {rows.length > 2 && (
                <button type="button" className="btn-ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  Hapus
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={() => setRows((rs) => [...rs, blank()])}>
          + Tambah milestone
        </button>
        <p className="text-xs text-slate-500">Milestone pertama dicairkan saat token sold out sebagai modal awal.</p>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="font-bold">Profil pemilik</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Lokasi</label>
            <input className="input" value={f.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <label className="label">Bio singkat</label>
            <input className="input" value={f.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Spesifikasi (satu per baris: lahan, dokumen, dll)</label>
          <textarea className="input" rows={3} value={f.specs} onChange={(e) => set("specs", e.target.value)} />
        </div>
        <div>
          <label className="label">Unggah bukti awal (dokumen kepemilikan, foto lokasi)</label>
          <input type="file" multiple className="text-sm" />
          <p className="mt-1 text-xs text-slate-500">Demo: file tidak diunggah; pada versi onchain hash dan CID IPFS dicatat di Jejak.</p>
        </div>
      </section>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <button className="btn-buy">Buat dan buka penjualan token</button>
    </form>
  );
}

"use client";

import Link from "next/link";
import type { Effort } from "@/lib/types";
import { useStore } from "@/lib/store";
import { indicativeValue, phaseOf, tokenPrice } from "@/lib/logic";
import { rupiah, rupiahShort } from "@/lib/format";

export const PHASE_LABEL = {
  selling: { text: "Penjualan awal", cls: "bg-sky-100 text-sky-800" },
  running: { text: "Berjalan", cls: "bg-emerald-100 text-emerald-800" },
  completed: { text: "Selesai", cls: "bg-violet-100 text-violet-800" },
  failed: { text: "Gagal / hangus", cls: "bg-rose-100 text-rose-800" },
} as const;

export function EffortCard({ effort: e }: { effort: Effort }) {
  const { state, now } = useStore();
  const phase = phaseOf(e, now);
  const owner = state.users[e.ownerId];
  const done = e.milestones.filter((m) => m.status === "verified").length;
  const pct = Math.round((done / e.milestones.length) * 100);
  const left = e.tokenSupply - e.sold;
  const badge = PHASE_LABEL[phase];

  return (
    <Link href={`/effort/${e.id}`} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-700">{owner?.name ?? e.ownerId}</p>
          <h3 className="mt-0.5 text-lg font-bold leading-snug">{e.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{e.category}</p>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Progres milestone</span>
          <span>
            {done}/{e.milestones.length}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Harga token</dt>
          <dd className="font-semibold">{rupiah(phase === "selling" ? tokenPrice(e) : indicativeValue(e))}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sisa token</dt>
          <dd className="font-semibold">
            {left}/{e.tokenSupply}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Tokenisasi</dt>
          <dd className="font-semibold">{rupiahShort(e.totalValue)}</dd>
        </div>
      </dl>
    </Link>
  );
}

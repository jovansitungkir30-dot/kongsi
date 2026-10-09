"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { holdingOf, indicativeValue, phaseOf, refundValue } from "@/lib/logic";
import { rupiah } from "@/lib/format";
import { PHASE_LABEL } from "@/components/EffortCard";

export default function PortofolioPage() {
  const { state, now } = useStore();
  const rows = state.efforts
    .map((e) => ({ e, n: holdingOf(state, e.id, state.me) }))
    .filter((r) => r.n > 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Portofolio Token</h1>
      <p className="mb-6 text-sm text-slate-600">Token yang dipegang {state.users[state.me].name}.</p>
      {rows.length === 0 ? (
        <p className="text-slate-500">Belum memegang token. Jelajahi effort dan beli token pertama Anda.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Effort</th>
                <th className="p-3">Status</th>
                <th className="p-3">Token</th>
                <th className="p-3">Nilai kini</th>
                <th className="p-3">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, n }) => {
                const phase = phaseOf(e, now);
                const b = PHASE_LABEL[phase];
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <Link href={`/effort/${e.id}`} className="font-semibold text-brand-700 hover:underline">
                        {state.users[e.ownerId]?.name}: {e.title}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>
                    </td>
                    <td className="p-3">{n}</td>
                    <td className="p-3">{rupiah(n * indicativeValue(e))}</td>
                    <td className="p-3 text-xs text-slate-600">
                      {phase === "failed" &&
                        (e.refunded[state.me] ? "Refund diambil" : `Refund tersedia ${rupiah(refundValue(e, n))}`)}
                      {phase === "completed" &&
                        (e.payoutPool === undefined ? "Menunggu setoran hasil" : e.claimed[state.me] ? "Sudah diklaim" : "Siap diklaim")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

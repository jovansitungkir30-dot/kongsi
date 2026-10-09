"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { failedReason, phaseOf } from "@/lib/logic";
import { PHASE_LABEL } from "@/components/EffortCard";
import { MilestoneCard } from "@/components/MilestoneCard";
import { TokenPanel } from "@/components/TokenPanel";
import { SecondaryMarket } from "@/components/SecondaryMarket";
import { rupiahShort } from "@/lib/format";

export default function EffortDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, now } = useStore();
  const [tab, setTab] = useState<"jejak" | "pasar">("jejak");
  const e = state.efforts.find((x) => x.id === id);

  if (!e) {
    return (
      <div>
        <p>Effort tidak ditemukan.</p>
        <Link href="/" className="text-brand-700 underline">
          Kembali
        </Link>
      </div>
    );
  }

  const owner = state.users[e.ownerId];
  const phase = phaseOf(e, now);
  const reason = failedReason(e, now);
  const badge = PHASE_LABEL[phase];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <header>
          <Link href="/" className="text-xs text-slate-500 hover:underline">
            ← Jelajahi Effort
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold">
              {owner?.name}: {e.title}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{e.summary}</p>
          <p className="mt-1 text-sm">
            <b>Target:</b> {e.target} · <b>Tokenisasi</b> {rupiahShort(e.totalValue)}
          </p>
          {reason && <p className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{reason}. Token hangus.</p>}
        </header>

        <section>
          <h2 className="mb-3 text-lg font-bold">Histori & profil pemilik</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="font-semibold">Portofolio</h3>
              {e.profile.portfolio.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Belum ada effort sebelumnya.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {e.profile.portfolio.map((p) => (
                    <li key={p.title}>
                      <span className="font-medium">{p.title}</span> ({p.year})
                      <br />
                      <span className="text-slate-600">{p.result}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-4">
              <h3 className="font-semibold">Spesifikasi</h3>
              <p className="mt-2 text-sm text-slate-600">{e.profile.bio}</p>
              <p className="mt-1 text-xs text-slate-500">📍 {e.profile.location}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {e.profile.specs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex gap-2 border-b border-slate-200">
            {(
              [
                ["jejak", "Jejak (bukti milestone)"],
                ["pasar", "Pasar Sekunder"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                  tab === k ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "jejak" ? (
            <div className="grid max-h-[560px] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              {e.milestones.map((m, i) => (
                <MilestoneCard key={m.id} effort={e} milestone={m} index={i} />
              ))}
            </div>
          ) : (
            <SecondaryMarket effort={e} />
          )}
        </section>
      </div>

      <TokenPanel effort={e} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { EffortCard } from "@/components/EffortCard";
import { useStore } from "@/lib/store";

export default function JelajahiPage() {
  const { state, query } = useStore();
  const q = query.trim().toLowerCase();
  const efforts = state.efforts.filter((e) => {
    if (!q) return true;
    const owner = state.users[e.ownerId]?.name ?? "";
    return [e.title, e.category, owner, e.summary].some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Jelajahi Effort</h1>
          <p className="text-sm text-slate-600">
            Danai usaha nyata yang terbukti lewat Jejak: setiap milestone punya bukti yang bisa diperiksa.
          </p>
        </div>
        <Link href="/effort/baru" className="btn-buy">
          + Buat Effort
        </Link>
      </div>
      {efforts.length === 0 ? (
        <p className="text-slate-500">Tidak ada effort yang cocok dengan pencarian.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {efforts.map((e) => (
            <EffortCard key={e.id} effort={e} />
          ))}
        </div>
      )}
    </div>
  );
}

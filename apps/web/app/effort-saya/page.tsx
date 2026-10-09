"use client";

import Link from "next/link";
import { EffortCard } from "@/components/EffortCard";
import { useStore } from "@/lib/store";

export default function EffortSayaPage() {
  const { state } = useStore();
  const mine = state.efforts.filter((e) => e.ownerId === state.me);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Effort Saya</h1>
        <Link href="/effort/baru" className="btn-buy">
          + Buat Effort
        </Link>
      </div>
      {mine.length === 0 ? (
        <p className="text-slate-500">
          Akun {state.users[state.me].name} belum punya effort. Pilih akun pemilik (mis. Petani x) di topbar atau buat effort baru.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((e) => (
            <EffortCard key={e.id} effort={e} />
          ))}
        </div>
      )}
    </div>
  );
}

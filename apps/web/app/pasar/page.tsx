"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { activeListings } from "@/lib/logic";
import { rupiah } from "@/lib/format";

export default function PasarPage() {
  const { state, buyListing, cancelListing } = useStore();
  const rows = activeListings(state);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Pasar Sekunder</h1>
      <p className="mb-6 text-sm text-slate-600">Jual beli token antar investor sampai milestone terakhir tercapai.</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Effort</th>
              <th className="p-3">Penjual</th>
              <th className="p-3">Jumlah</th>
              <th className="p-3">Harga / token</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500">
                  Belum ada listing aktif.
                </td>
              </tr>
            )}
            {rows.map((l) => {
              const e = state.efforts.find((x) => x.id === l.effortId);
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <Link href={`/effort/${l.effortId}`} className="font-semibold text-brand-700 hover:underline">
                      {e?.title}
                    </Link>
                  </td>
                  <td className="p-3">{state.users[l.seller]?.name}</td>
                  <td className="p-3">{l.amount}</td>
                  <td className="p-3">{rupiah(l.price)}</td>
                  <td className="p-3 text-right">
                    {l.seller === state.me ? (
                      <button className="btn-ghost !py-1" onClick={() => cancelListing(l.id)}>
                        Batalkan
                      </button>
                    ) : (
                      <button className="btn-buy !py-1" disabled={state.me === e?.ownerId} onClick={() => buyListing(l.id)}>
                        Beli
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

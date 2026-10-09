"use client";

import { useState } from "react";
import type { Effort } from "@/lib/types";
import { useStore } from "@/lib/store";
import { activeListings, holdingOf, indicativeValue, lockedTokens, phaseOf } from "@/lib/logic";
import { rupiah } from "@/lib/format";

export function SecondaryMarket({ effort: e }: { effort: Effort }) {
  const { state, now, list, cancelListing, buyListing } = useStore();
  const phase = phaseOf(e, now);
  const open = phase === "selling" || phase === "running";
  const rows = activeListings(state, e.id);
  const free = holdingOf(state, e.id, state.me) - lockedTokens(state, e.id, state.me);
  const [amount, setAmount] = useState(1);
  const [price, setPrice] = useState(Math.round(indicativeValue(e)));

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Penjual</th>
              <th className="p-3">Jumlah</th>
              <th className="p-3">Harga / token</th>
              <th className="p-3">Total</th>
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
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="p-3">{state.users[l.seller]?.name ?? l.seller}</td>
                <td className="p-3">{l.amount}</td>
                <td className="p-3">{rupiah(l.price)}</td>
                <td className="p-3">{rupiah(l.amount * l.price)}</td>
                <td className="p-3 text-right">
                  {l.seller === state.me ? (
                    <button className="btn-ghost !py-1" onClick={() => cancelListing(l.id)}>
                      Batalkan
                    </button>
                  ) : (
                    <button className="btn-buy !py-1" disabled={!open || state.me === e.ownerId} onClick={() => buyListing(l.id)}>
                      Beli
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && free > 0 && (
        <div className="card space-y-3 p-4">
          <h4 className="font-semibold">Jual token Anda ({free} tersedia)</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jumlah</label>
              <input
                type="number"
                min={1}
                max={free}
                className="input"
                value={amount}
                onChange={(ev) => setAmount(Math.floor(Number(ev.target.value)) || 1)}
              />
            </div>
            <div>
              <label className="label">Harga / token (Rp)</label>
              <input type="number" className="input" value={price} onChange={(ev) => setPrice(Number(ev.target.value))} />
            </div>
          </div>
          <button className="btn-buy" onClick={() => list(e.id, amount, price)}>
            Buat listing jual
          </button>
        </div>
      )}
      {!open && <p className="text-sm text-slate-500">Perdagangan ditutup karena effort sudah {phase === "completed" ? "selesai" : "gagal"}.</p>}
    </div>
  );
}

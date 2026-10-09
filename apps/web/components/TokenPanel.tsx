"use client";

import { useState } from "react";
import type { Effort } from "@/lib/types";
import { useStore } from "@/lib/store";
import { holdingOf, indicativeValue, phaseOf, refundValue, releasedBps, tokenPrice } from "@/lib/logic";
import { rupiah, rupiahShort } from "@/lib/format";
import { PriceChart } from "./PriceChart";

export function TokenPanel({ effort: e }: { effort: Effort }) {
  const { state, now, buyPrimary, refund, depositRevenue, claim } = useStore();
  const [qty, setQty] = useState(1);
  const [revenue, setRevenue] = useState(e.maxYield > 0 ? Math.round(e.totalValue * 1.6) : 0);

  const phase = phaseOf(e, now);
  const price = tokenPrice(e);
  const value = indicativeValue(e);
  const left = e.tokenSupply - e.sold;
  const mine = holdingOf(state, e.id, state.me);
  const isOwner = state.me === e.ownerId;
  const total = qty * price;

  return (
    <aside className="card sticky top-0 space-y-4 p-4">
      <h3 className="text-lg font-bold">Ringkasan token</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Total tokenisasi</dt>
          <dd className="font-semibold">{rupiahShort(e.totalValue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Max yield</dt>
          <dd className="font-semibold">{rupiahShort(e.maxYield)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Harga awal / token</dt>
          <dd className="font-semibold">{rupiah(price)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Nilai kini / token</dt>
          <dd className="font-semibold text-brand-700">{rupiah(value)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sisa token</dt>
          <dd className="font-semibold">
            {left}/{e.tokenSupply}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Dana dicairkan</dt>
          <dd className="font-semibold">{releasedBps(e) / 100}%</dd>
        </div>
      </dl>

      <PriceChart trades={e.trades} current={value} />

      {phase === "selling" && !isOwner && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={left}
              className="input"
              value={qty}
              onChange={(ev) => setQty(Math.max(1, Math.min(left, Math.floor(Number(ev.target.value) || 1))))}
            />
            <span className="whitespace-nowrap text-xs text-slate-500">token</span>
          </div>
          <button className="btn-buy w-full !bg-green-600 hover:!bg-green-700" onClick={() => buyPrimary(e.id, qty)}>
            BUY · {rupiah(total)}
          </button>
          <p className="text-xs text-slate-500">
            Effort baru berjalan setelah seluruh token terjual. Jika tenggat penjualan lewat, dana dikembalikan.
          </p>
        </div>
      )}
      {phase === "selling" && isOwner && <p className="text-sm text-slate-500">Menunggu seluruh token terjual.</p>}
      {phase === "running" && (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          Token sold out. Beli dari investor lain di tab Pasar Sekunder.
        </p>
      )}

      {phase === "failed" && (
        <div className="space-y-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <p className="font-semibold">Token hangus</p>
          {mine > 0 && !e.refunded[state.me] ? (
            <>
              <p>
                Refund Anda: <b>{rupiah(refundValue(e, mine))}</b> untuk {mine} token.
              </p>
              <button className="btn-buy w-full" onClick={() => refund(e.id)}>
                Ambil refund
              </button>
            </>
          ) : (
            <p>{e.refunded[state.me] ? "Refund sudah Anda ambil." : "Anda tidak memegang token effort ini."}</p>
          )}
        </div>
      )}

      {phase === "completed" && (
        <div className="space-y-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-800">
          <p className="font-semibold">Effort selesai</p>
          {e.payoutPool === undefined ? (
            isOwner ? (
              <>
                <label className="label">Hasil penjualan (Rp)</label>
                <input
                  type="number"
                  className="input"
                  value={revenue}
                  onChange={(ev) => setRevenue(Number(ev.target.value))}
                />
                <button className="btn-buy w-full" onClick={() => depositRevenue(e.id, revenue)}>
                  Setor hasil
                </button>
                <p className="text-xs">Pembagian dibatasi max yield {rupiah(e.maxYield)}.</p>
              </>
            ) : (
              <p>Menunggu pemilik menyetor hasil penjualan.</p>
            )
          ) : mine > 0 && !e.claimed[state.me] ? (
            <>
              <p>
                Bagian Anda: <b>{rupiah((e.payoutPool * mine) / e.tokenSupply)}</b>
              </p>
              <button className="btn-buy w-full" onClick={() => claim(e.id)}>
                Klaim hasil
              </button>
            </>
          ) : (
            <p>
              Dibagikan {rupiah(e.payoutPool)} dari hasil {rupiah(e.revenueGross ?? 0)}.
              {e.claimed[state.me] ? " Anda sudah klaim." : ""}
            </p>
          )}
        </div>
      )}

      {mine > 0 && <p className="text-xs text-slate-500">Anda memegang {mine} token.</p>}
    </aside>
  );
}

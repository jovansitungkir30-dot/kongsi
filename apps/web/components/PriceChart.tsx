import type { Trade } from "@/lib/types";
import { rupiah } from "@/lib/format";

export function PriceChart({ trades, current }: { trades: Trade[]; current: number }) {
  const pts = [...trades.map((t) => t.price), current];
  if (pts.length < 2) return null;
  const w = 280;
  const h = 90;
  const pad = 6;
  const min = Math.min(...pts) * 0.95;
  const max = Math.max(...pts) * 1.05;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Grafik harga token">
        <path d={`${d} L${x(pts.length - 1)},${h - pad} L${x(0)},${h - pad} Z`} className="fill-brand-100" />
        <path d={d} className="fill-none stroke-brand-600" strokeWidth={2} />
        {pts.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === pts.length - 1 ? 4 : 2.5} className="fill-brand-600" />
        ))}
      </svg>
      <figcaption className="flex justify-between text-[10px] text-slate-500">
        <span>Awal {rupiah(pts[0])}</span>
        <span>Nilai kini {rupiah(current)}</span>
      </figcaption>
    </figure>
  );
}

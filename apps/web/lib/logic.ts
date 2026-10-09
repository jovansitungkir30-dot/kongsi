import type { Effort, Listing, Phase, State } from "./types";

export const tokenPrice = (e: Effort) => e.totalValue / e.tokenSupply;

/** Alasan effort gagal (token hangus, dana dikembalikan), atau null jika tidak gagal. */
export function failedReason(e: Effort, now: number): string | null {
  if (e.milestones.every((m) => m.status === "verified")) return null;
  if (e.sold < e.tokenSupply) {
    return new Date(e.saleDeadline).getTime() < now
      ? "Penjualan awal berakhir sebelum semua token terjual"
      : null;
  }
  for (const m of e.milestones) {
    if (m.status === "rejected") return `Milestone "${m.title}" ditolak pemegang token`;
    if (m.status !== "verified" && new Date(m.deadline).getTime() < now)
      return `Milestone "${m.title}" tidak terpenuhi sebelum tenggat`;
  }
  return null;
}

export function phaseOf(e: Effort, now: number): Phase {
  if (failedReason(e, now)) return "failed";
  if (e.sold < e.tokenSupply) return "selling";
  if (e.milestones.every((m) => m.status === "verified")) return "completed";
  return "running";
}

/** Porsi dana (bps) yang sudah dicairkan ke pemilik. Milestone pertama cair saat sold out. */
export function releasedBps(e: Effort): number {
  if (e.sold < e.tokenSupply) return 0;
  return e.milestones.reduce(
    (sum, m, i) => (i === 0 || m.status === "verified" ? sum + m.weightBps : sum),
    0,
  );
}

export function verifiedFraction(e: Effort): number {
  const total = e.milestones.reduce((s, m) => s + m.weightBps, 0) || 1;
  const done = e.milestones.reduce((s, m) => (m.status === "verified" ? s + m.weightBps : s), 0);
  return done / total;
}

/** Nilai indikatif token: naik seiring milestone terverifikasi. */
export function indicativeValue(e: Effort): number {
  return tokenPrice(e) * (1 + 0.5 * verifiedFraction(e));
}

export function lockedTokens(s: State, effortId: string, userId: string): number {
  return s.listings
    .filter((l) => l.active && l.effortId === effortId && l.seller === userId)
    .reduce((n, l) => n + l.amount, 0);
}

export function holdingOf(s: State, effortId: string, userId: string): number {
  return s.holdings[effortId]?.[userId] ?? 0;
}

export function refundValue(e: Effort, tokens: number): number {
  return tokens * tokenPrice(e) * (1 - releasedBps(e) / 10000);
}

export function activeListings(s: State, effortId?: string): Listing[] {
  return s.listings.filter((l) => l.active && (!effortId || l.effortId === effortId));
}

/** Bobot suara user pada milestone: saldo token saat snapshot. */
export function voteWeight(m: { snapshot?: Record<string, number> }, userId: string): number {
  return m.snapshot?.[userId] ?? 0;
}

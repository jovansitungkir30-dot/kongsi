"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Effort, Evidence, Milestone, State } from "./types";
import { seedState } from "./seed";
import { holdingOf, lockedTokens, phaseOf, refundValue, tokenPrice } from "./logic";

const KEY = "kongsi-demo-v1";

export interface Result {
  ok: boolean;
  msg: string;
}
const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export interface NewEffortInput {
  title: string;
  category: string;
  summary: string;
  target: string;
  totalValue: number;
  maxYield: number;
  tokenSupply: number;
  saleDeadline: string;
  bio: string;
  location: string;
  specs: string[];
  milestones: { title: string; description: string; deadline: string; weightBps: number }[];
  firstEvidence?: Evidence;
}

export type Ret<T> = T | Promise<T>;

export interface Store {
  /** "demo" = data mock di browser, "chain" = kontrak di testnet */
  mode: "demo" | "chain";
  /** true bila alamat kontrak dikonfigurasi lewat env */
  chainAvailable: boolean;
  connect: () => Promise<void>;
  state: State;
  now: number;
  query: string;
  setQuery: (q: string) => void;
  toast: string | null;
  switchUser: (id: string) => void;
  buyPrimary: (effortId: string, amount: number) => Ret<Result>;
  createEffort: (input: NewEffortInput) => Ret<Result & { id?: string }>;
  submitEvidence: (effortId: string, milestoneId: string, ev: Evidence) => Ret<Result>;
  vote: (effortId: string, milestoneId: string, approve: boolean) => Ret<Result>;
  list: (effortId: string, amount: number, price: number) => Ret<Result>;
  cancelListing: (listingId: string) => Ret<Result>;
  buyListing: (listingId: string) => Ret<Result>;
  refund: (effortId: string) => Ret<Result>;
  depositRevenue: (effortId: string, amount: number) => Ret<Result>;
  claim: (effortId: string) => Ret<Result>;
  faucet: () => void;
  reset: () => void;
}

export const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore harus dipakai di dalam StoreProvider");
  return s;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(seedState);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw) as State);
    } catch {}
    loaded.current = true;
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Jalankan mutasi atas salinan state; tampilkan toast; simpan jika sukses. */
  const run = useCallback((fn: (s: State) => Result): Result => {
    const draft = structuredClone(stateRef.current);
    const res = fn(draft);
    if (res.ok) {
      stateRef.current = draft;
      setState(draft);
    }
    setToast(res.msg);
    return res;
  }, []);

  const store = useMemo<Store>(() => {
    const t0 = () => Date.now();
    const iso = () => new Date().toISOString();
    const effortOf = (s: State, id: string) => s.efforts.find((e) => e.id === id);
    const pay = (s: State, from: string, to: string, amount: number) => {
      s.users[from].balance -= amount;
      s.users[to].balance += amount;
    };
    const addHolding = (s: State, effortId: string, user: string, n: number) => {
      const h = (s.holdings[effortId] ??= {});
      h[user] = (h[user] ?? 0) + n;
      if (h[user] <= 0) delete h[user];
    };
    const release = (s: State, e: Effort, bps: number) => {
      const o = s.users[e.ownerId];
      if (o) o.balance += (e.totalValue * bps) / 10000;
    };

    return {
      mode: "demo",
      chainAvailable: Boolean(process.env.NEXT_PUBLIC_KONGSI_ADDRESS),
      connect: async () => {},
      state,
      now,
      query,
      setQuery,
      toast,
      switchUser: (id) => setState((s) => ({ ...s, me: id })),

      buyPrimary: (effortId, amount) =>
        run((s) => {
          const e = effortOf(s, effortId);
          if (!e) return fail("Effort tidak ditemukan.");
          if (phaseOf(e, t0()) !== "selling") return fail("Penjualan awal sudah ditutup.");
          if (s.me === e.ownerId) return fail("Pemilik tidak bisa membeli token effort sendiri.");
          if (!Number.isInteger(amount) || amount < 1) return fail("Jumlah token tidak valid.");
          if (amount > e.tokenSupply - e.sold) return fail("Melebihi sisa token.");
          const cost = amount * tokenPrice(e);
          if (s.users[s.me].balance < cost) return fail("Saldo tidak cukup. Gunakan faucet demo.");
          s.users[s.me].balance -= cost;
          e.sold += amount;
          addHolding(s, e.id, s.me, amount);
          if (e.sold === e.tokenSupply) {
            release(s, e, e.milestones[0].weightBps);
            return ok(`Token terjual habis. Effort berjalan, dana tahap awal dicairkan ke pemilik.`);
          }
          return ok(`Berhasil membeli ${amount} token.`);
        }),

      createEffort: (input) => {
        let newId: string | undefined;
        const res = run((s) => {
          const total = input.milestones.reduce((n, m) => n + m.weightBps, 0);
          if (!input.title.trim()) return fail("Judul wajib diisi.");
          if (input.milestones.length < 2) return fail("Minimal 2 milestone.");
          if (total !== 10000) return fail("Total bobot milestone harus 100%.");
          if (input.totalValue <= 0 || input.tokenSupply <= 0) return fail("Nilai tokenisasi dan jumlah token harus > 0.");
          let id = slug(input.title) || "effort";
          while (s.efforts.some((e) => e.id === id)) id += "-x";
          newId = id;
          const milestones: Milestone[] = input.milestones.map((m, i) => ({
            id: `m${i + 1}`,
            title: m.title,
            description: m.description,
            deadline: new Date(m.deadline).toISOString(),
            weightBps: m.weightBps,
            status: "pending",
            yes: 0,
            no: 0,
            voted: {},
          }));
          s.efforts.unshift({
            id,
            ownerId: s.me,
            title: input.title,
            category: input.category || "Lainnya",
            summary: input.summary,
            target: input.target,
            totalValue: input.totalValue,
            maxYield: input.maxYield,
            tokenSupply: input.tokenSupply,
            sold: 0,
            saleDeadline: new Date(input.saleDeadline).toISOString(),
            createdAt: iso(),
            milestones,
            profile: { bio: input.bio, location: input.location, specs: input.specs, portfolio: [] },
            trades: [{ t: iso(), price: input.totalValue / input.tokenSupply }],
            refunded: {},
            claimed: {},
          });
          return ok("Effort dibuat dan dibuka untuk penjualan token.");
        });
        return { ...res, id: newId };
      },

      submitEvidence: (effortId, milestoneId, ev) =>
        run((s) => {
          const e = effortOf(s, effortId);
          if (!e) return fail("Effort tidak ditemukan.");
          if (s.me !== e.ownerId) return fail("Hanya pemilik effort yang dapat mengunggah bukti.");
          if (phaseOf(e, t0()) !== "running") return fail("Effort belum berjalan atau sudah selesai.");
          const idx = e.milestones.findIndex((m) => m.id === milestoneId);
          const m = e.milestones[idx];
          if (!m || m.status !== "pending") return fail("Milestone tidak dapat diunggah buktinya.");
          if (e.milestones.slice(0, idx).some((p) => p.status !== "verified"))
            return fail("Selesaikan milestone sebelumnya terlebih dahulu.");
          m.evidence = ev;
          m.status = "submitted";
          m.snapshot = { ...(s.holdings[e.id] ?? {}) };
          return ok("Bukti tercatat di Jejak. Menunggu voting pemegang token.");
        }),

      vote: (effortId, milestoneId, approve) =>
        run((s) => {
          const e = effortOf(s, effortId);
          const m = e?.milestones.find((x) => x.id === milestoneId);
          if (!e || !m) return fail("Milestone tidak ditemukan.");
          if (m.status !== "submitted") return fail("Milestone tidak sedang dalam voting.");
          if (new Date(m.deadline).getTime() < t0()) return fail("Tenggat milestone sudah lewat.");
          const w = m.snapshot?.[s.me] ?? 0;
          if (w <= 0) return fail("Anda tidak memegang token saat bukti diunggah.");
          if (m.voted[s.me]) return fail("Anda sudah memberi suara.");
          m.voted[s.me] = true;
          if (approve) m.yes += w;
          else m.no += w;
          if (m.yes * 2 > e.tokenSupply) {
            m.status = "verified";
            const idx = e.milestones.indexOf(m);
            if (idx > 0) release(s, e, m.weightBps);
            return ok("Mayoritas setuju. Milestone terverifikasi dan dana tahap ini dicairkan.");
          }
          if (m.no * 2 >= e.tokenSupply) {
            m.status = "rejected";
            return ok("Mayoritas menolak. Effort gagal, token hangus dan dana sisa bisa direfund.");
          }
          return ok("Suara tercatat.");
        }),

      list: (effortId, amount, price) =>
        run((s) => {
          const e = effortOf(s, effortId);
          if (!e) return fail("Effort tidak ditemukan.");
          const ph = phaseOf(e, t0());
          if (ph === "completed" || ph === "failed") return fail("Token tidak bisa diperdagangkan lagi.");
          if (!Number.isInteger(amount) || amount < 1) return fail("Jumlah tidak valid.");
          if (price <= 0) return fail("Harga tidak valid.");
          const free = holdingOf(s, effortId, s.me) - lockedTokens(s, effortId, s.me);
          if (amount > free) return fail("Token tersedia tidak cukup.");
          s.listings.push({
            id: `l${Date.now()}`,
            effortId,
            seller: s.me,
            amount,
            price,
            active: true,
            createdAt: iso(),
          });
          return ok("Listing jual dibuat.");
        }),

      cancelListing: (listingId) =>
        run((s) => {
          const l = s.listings.find((x) => x.id === listingId);
          if (!l || !l.active) return fail("Listing tidak ditemukan.");
          if (l.seller !== s.me) return fail("Bukan listing Anda.");
          l.active = false;
          return ok("Listing dibatalkan.");
        }),

      buyListing: (listingId) =>
        run((s) => {
          const l = s.listings.find((x) => x.id === listingId);
          if (!l || !l.active) return fail("Listing sudah tidak aktif.");
          const e = effortOf(s, l.effortId);
          if (!e) return fail("Effort tidak ditemukan.");
          const ph = phaseOf(e, t0());
          if (ph === "completed" || ph === "failed") return fail("Token tidak bisa diperdagangkan lagi.");
          if (l.seller === s.me) return fail("Tidak bisa membeli listing sendiri.");
          if (s.me === e.ownerId) return fail("Pemilik tidak bisa membeli token effort sendiri.");
          const cost = l.amount * l.price;
          if (s.users[s.me].balance < cost) return fail("Saldo tidak cukup.");
          pay(s, s.me, l.seller, cost);
          addHolding(s, e.id, l.seller, -l.amount);
          addHolding(s, e.id, s.me, l.amount);
          l.active = false;
          e.trades.push({ t: iso(), price: l.price });
          return ok(`Berhasil membeli ${l.amount} token dari pasar sekunder.`);
        }),

      refund: (effortId) =>
        run((s) => {
          const e = effortOf(s, effortId);
          if (!e) return fail("Effort tidak ditemukan.");
          if (phaseOf(e, t0()) !== "failed") return fail("Effort tidak berstatus gagal.");
          if (e.refunded[s.me]) return fail("Refund sudah diambil.");
          const n = holdingOf(s, effortId, s.me);
          if (n <= 0) return fail("Anda tidak memegang token effort ini.");
          const amount = refundValue(e, n);
          s.users[s.me].balance += amount;
          e.refunded[s.me] = true;
          return ok(`Refund diterima untuk ${n} token.`);
        }),

      depositRevenue: (effortId, amount) =>
        run((s) => {
          const e = effortOf(s, effortId);
          if (!e) return fail("Effort tidak ditemukan.");
          if (s.me !== e.ownerId) return fail("Hanya pemilik effort.");
          if (phaseOf(e, t0()) !== "completed") return fail("Semua milestone harus terverifikasi.");
          if (e.payoutPool !== undefined) return fail("Hasil sudah disetor.");
          if (amount <= 0) return fail("Jumlah tidak valid.");
          const pool = Math.min(amount, e.maxYield);
          if (s.users[s.me].balance < pool) return fail("Saldo pemilik tidak cukup untuk setoran.");
          s.users[s.me].balance -= pool;
          e.revenueGross = amount;
          e.payoutPool = pool;
          return ok(
            amount > e.maxYield
              ? "Hasil disetor. Pembagian dibatasi max yield, sisa tetap milik pemilik."
              : "Hasil disetor dan siap diklaim pemegang token.",
          );
        }),

      claim: (effortId) =>
        run((s) => {
          const e = effortOf(s, effortId);
          if (!e || e.payoutPool === undefined) return fail("Belum ada hasil untuk diklaim.");
          if (e.claimed[s.me]) return fail("Sudah diklaim.");
          const n = holdingOf(s, effortId, s.me);
          if (n <= 0) return fail("Anda tidak memegang token effort ini.");
          s.users[s.me].balance += (e.payoutPool * n) / e.tokenSupply;
          e.claimed[s.me] = true;
          return ok("Hasil berhasil diklaim.");
        }),

      faucet: () => {
        run((s) => {
          s.users[s.me].balance += 100_000_000;
          return ok("Faucet demo: +Rp100.000.000 MockIDR.");
        });
      },

      reset: () => {
        const fresh = seedState();
        stateRef.current = fresh;
        setState(fresh);
        setToast("Data demo direset.");
      },
    };
  }, [state, now, query, toast, run]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

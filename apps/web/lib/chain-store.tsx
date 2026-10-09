"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  maxUint256,
  type Address,
  type Hex,
} from "viem";
import { foundry, sepolia } from "viem/chains";
import { kongsiAbi } from "./abi/kongsi";
import { idrAbi } from "./abi/idr";
import { Ctx, type NewEffortInput, type Result, type Store } from "./store";
import type { Effort, Listing, Milestone, State, User } from "./types";

const KONGSI = process.env.NEXT_PUBLIC_KONGSI_ADDRESS as Address | undefined;
const IDR = process.env.NEXT_PUBLIC_IDR_ADDRESS as Address | undefined;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
const RPC = process.env.NEXT_PUBLIC_RPC_URL;
const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? 0);

const UNIT = 1_000_000; // MockIDR 6 desimal
const chain = CHAIN_ID === 31337 ? foundry : sepolia;
const publicClient = createPublicClient({ chain, transport: http(RPC) });

const NONE = "0x0000000000000000000000000000000000000000";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const rp = (v: bigint) => Number(v) / UNIT;
const iso = (sec: bigint | number) => new Date(Number(sec) * 1000).toISOString();

interface Meta {
  title?: string;
  category?: string;
  summary?: string;
  target?: string;
  bio?: string;
  location?: string;
  specs?: string[];
  milestones?: { title: string; description: string }[];
}

function encodeMeta(m: Meta): string {
  return "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(m))));
}

function decodeMeta(uri: string): Meta {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const raw = atob(uri.slice("data:application/json;base64,".length));
      return JSON.parse(decodeURIComponent(escape(raw))) as Meta;
    }
  } catch {}
  return {};
}

const MSTATE = ["pending", "submitted", "verified", "rejected"] as const;

const emptyState = (me: string): State => ({
  me,
  users: { [me]: { id: me, name: "Belum terhubung", role: "Investor", balance: 0 } },
  efforts: [],
  listings: [],
  holdings: {},
});

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: () => void) => void };

function errMsg(e: unknown): string {
  const x = e as { shortMessage?: string; message?: string };
  return x.shortMessage ?? x.message ?? "Transaksi gagal.";
}

async function loadState(me: Address | null): Promise<State> {
  if (!KONGSI || !IDR) return emptyState(me ?? "tidak-terhubung");
  const read = <T,>(functionName: string, args: unknown[] = []) =>
    publicClient.readContract({ address: KONGSI, abi: kongsiAbi, functionName, args } as never) as Promise<T>;

  const meKey = me ? me.toLowerCase() : "tidak-terhubung";
  const users: Record<string, User> = {};
  const touch = (addr: string, role: User["role"]) => {
    const k = addr.toLowerCase();
    users[k] ??= { id: k, name: short(addr), role, balance: 0 };
  };
  touch(meKey === "tidak-terhubung" ? NONE : meKey, "Investor");
  if (me) {
    const bal = (await publicClient.readContract({ address: IDR, abi: idrAbi, functionName: "balanceOf", args: [me] })) as bigint;
    users[meKey] = { id: meKey, name: `Anda (${short(me)})`, role: "Investor", balance: rp(bal) };
  } else {
    users[meKey] = { id: meKey, name: "Belum terhubung", role: "Investor", balance: 0 };
  }

  const count = Number(await read<bigint>("effortCount"));
  const holdings: State["holdings"] = {};
  const efforts: Effort[] = [];

  for (let id = 1; id <= count; id++) {
    const [e, ms] = await Promise.all([
      read<{
        owner: Address; metadataURI: string; totalValue: bigint; maxYield: bigint; tokenSupply: bigint;
        tokenPrice: bigint; saleDeadline: bigint; sold: bigint; revenueGross: bigint; payoutPool: bigint; revenueDeposited: boolean;
      }>("getEffort", [BigInt(id)]),
      read<{
        deadline: bigint; weightBps: number; state: number; evidenceCid: string; evidenceHash: Hex;
        snapshotBlock: bigint; yes: bigint; no: bigint;
      }[]>("getMilestones", [BigInt(id)]),
    ]);
    const meta = decodeMeta(e.metadataURI);
    touch(e.owner, "Pemilik effort");
    users[e.owner.toLowerCase()].role = "Pemilik effort";

    let refunded = false;
    let claimed = false;
    if (me) {
      const bal = await read<bigint>("balanceOf", [BigInt(id), me]);
      if (bal > 0n) holdings[String(id)] = { [meKey]: Number(bal) };
      [refunded, claimed] = await Promise.all([
        read<boolean>("refunded", [BigInt(id), me]),
        read<boolean>("claimed", [BigInt(id), me]),
      ]);
    }

    const milestones: Milestone[] = await Promise.all(
      ms.map(async (m, i) => {
        const status = MSTATE[m.state] ?? "pending";
        let weight = 0;
        let voted = false;
        if (me && (status === "submitted" || status === "verified")) {
          [weight, voted] = await Promise.all([
            read<bigint>("balanceAt", [BigInt(id), me, m.snapshotBlock]).then(Number),
            read<boolean>("hasVoted", [BigInt(id), BigInt(i), me]),
          ]);
        }
        return {
          id: `m${i}`,
          title: meta.milestones?.[i]?.title ?? `Milestone ${i + 1}`,
          description: meta.milestones?.[i]?.description ?? "",
          deadline: iso(m.deadline),
          weightBps: m.weightBps,
          status,
          evidence:
            status === "pending"
              ? undefined
              : {
                  fileName: "Bukti milestone",
                  note: "Disimpan offchain; hash dicatat onchain.",
                  cid: m.evidenceCid,
                  hash: m.evidenceHash,
                  uploadedAt: new Date().toISOString(),
                },
          snapshot: me ? { [meKey]: weight } : undefined,
          yes: Number(m.yes),
          no: Number(m.no),
          voted: me ? { [meKey]: voted } : {},
        } satisfies Milestone;
      }),
    );

    const price = rp(e.tokenPrice);
    efforts.push({
      id: String(id),
      ownerId: e.owner.toLowerCase(),
      title: meta.title ?? `Effort #${id}`,
      category: meta.category ?? "Lainnya",
      summary: meta.summary ?? "",
      target: meta.target ?? "",
      totalValue: rp(e.totalValue),
      maxYield: rp(e.maxYield),
      tokenSupply: Number(e.tokenSupply),
      sold: Number(e.sold),
      saleDeadline: iso(e.saleDeadline),
      createdAt: new Date().toISOString(),
      milestones,
      profile: { bio: meta.bio ?? "", location: meta.location ?? "", specs: meta.specs ?? [], portfolio: [] },
      trades: [{ t: "0", price }],
      revenueGross: e.revenueDeposited ? rp(e.revenueGross) : undefined,
      payoutPool: e.revenueDeposited ? rp(e.payoutPool) : undefined,
      refunded: me ? { [meKey]: refunded } : {},
      claimed: me ? { [meKey]: claimed } : {},
    });
  }

  const listingCount = Number(await read<bigint>("listingCount"));
  const listings: Listing[] = [];
  const effortById = new Map(efforts.map((e) => [e.id, e]));
  for (let i = 1; i <= listingCount; i++) {
    const l = await read<readonly [bigint, Address, bigint, bigint, boolean]>("listings", [BigInt(i)]);
    touch(l[1], "Investor");
    listings.push({
      id: `l${i}`,
      effortId: String(l[0]),
      seller: l[1].toLowerCase(),
      amount: Number(l[2]),
      price: rp(l[3]),
      active: l[4],
      createdAt: new Date().toISOString(),
    });
  }

  // riwayat harga dari pasar sekunder (opsional, bergantung batas getLogs RPC)
  try {
    const logs = await publicClient.getContractEvents({
      address: KONGSI,
      abi: kongsiAbi,
      eventName: "ListingFilled",
      fromBlock: DEPLOY_BLOCK,
    });
    for (const log of logs) {
      const a = log.args as { listingId?: bigint; amount?: bigint; cost?: bigint };
      if (!a.listingId || !a.amount || !a.cost) continue;
      const l = listings.find((x) => x.id === `l${a.listingId}`);
      const e = l && effortById.get(l.effortId);
      e?.trades.push({ t: String(log.blockNumber), price: Number(a.cost) / Number(a.amount) / UNIT });
    }
  } catch {}

  return { me: meKey, users, efforts, listings, holdings };
}

export function ChainStoreProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [state, setState] = useState<State>(() => emptyState("tidak-terhubung"));
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const accountRef = useRef<Address | null>(null);
  accountRef.current = account;

  const refresh = useCallback(async () => {
    try {
      setState(await loadState(accountRef.current));
      setNow(Date.now());
    } catch (e) {
      setToast(`Gagal memuat data onchain: ${errMsg(e)}`);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [account, refresh]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const eth = (window as unknown as { ethereum?: Eth }).ethereum;
    eth?.on?.("accountsChanged", () => window.location.reload());
    eth?.on?.("chainChanged", () => window.location.reload());
  }, []);

  const store = useMemo<Store>(() => {
    const eth = () => (window as unknown as { ethereum?: Eth }).ethereum;

    const wallet = () => {
      const e = eth();
      if (!e) throw new Error("Wallet tidak ditemukan. Pasang MetaMask.");
      return createWalletClient({ chain, transport: custom(e as never) });
    };

    const connect = async () => {
      try {
        const w = wallet();
        const [addr] = await w.requestAddresses();
        try {
          await w.switchChain({ id: chain.id });
        } catch {}
        setAccount(addr);
      } catch (e) {
        setToast(errMsg(e));
      }
    };

    /** Kirim transaksi, tunggu konfirmasi, lalu muat ulang state. */
    async function tx(
      fn: (me: Address, send: (p: { address: Address; abi: unknown; functionName: string; args: unknown[] }) => Promise<Hex>) => Promise<Hex | void>,
      okMsg: string,
    ): Promise<Result> {
      const me = accountRef.current;
      if (!me) {
        setToast("Hubungkan wallet terlebih dahulu.");
        return { ok: false, msg: "Wallet belum terhubung." };
      }
      try {
        const w = wallet();
        const send = (p: { address: Address; abi: unknown; functionName: string; args: unknown[] }) =>
          w.writeContract({ ...p, account: me, chain } as never) as Promise<Hex>;
        setToast("Menunggu konfirmasi wallet…");
        const hash = await fn(me, send);
        if (hash) await publicClient.waitForTransactionReceipt({ hash });
        await refresh();
        setToast(okMsg);
        return { ok: true, msg: okMsg };
      } catch (e) {
        const msg = errMsg(e);
        setToast(msg);
        return { ok: false, msg };
      }
    }

    async function ensureAllowance(me: Address, amountUnits: bigint, send: Parameters<Parameters<typeof tx>[0]>[1]) {
      const allowance = (await publicClient.readContract({
        address: IDR!, abi: idrAbi, functionName: "allowance", args: [me, KONGSI!],
      })) as bigint;
      if (allowance >= amountUnits) return;
      const h = await send({ address: IDR!, abi: idrAbi, functionName: "approve", args: [KONGSI!, maxUint256] });
      await publicClient.waitForTransactionReceipt({ hash: h });
    }

    const call = (functionName: string, args: unknown[]) => ({ address: KONGSI!, abi: kongsiAbi, functionName, args });
    const find = (id: string) => state.efforts.find((e) => e.id === id);
    const idx = (mid: string) => BigInt(mid.replace(/^m/, ""));
    const lid = (id: string) => BigInt(id.replace(/^l/, ""));
    const units = (rpAmount: number) => BigInt(Math.round(rpAmount * UNIT));

    return {
      mode: "chain",
      chainAvailable: true,
      connect,
      state,
      now,
      query,
      setQuery,
      toast,
      switchUser: () => {},

      buyPrimary: (effortId, amount) =>
        tx(async (me, send) => {
          const e = find(effortId);
          if (!e) throw new Error("Effort tidak ditemukan.");
          await ensureAllowance(me, units(e.totalValue / e.tokenSupply) * BigInt(amount), send);
          return send(call("buy", [BigInt(effortId), BigInt(amount)]));
        }, `Berhasil membeli ${amount} token.`),

      createEffort: async (input: NewEffortInput) => {
        const ms = input.milestones;
        const meta = encodeMeta({
          title: input.title,
          category: input.category,
          summary: input.summary,
          target: input.target,
          bio: input.bio,
          location: input.location,
          specs: input.specs,
          milestones: ms.map((m) => ({ title: m.title, description: m.description })),
        });
        const before = state.efforts.length;
        const res = await tx(
          (_me, send) =>
            send(
              call("createEffort", [
                meta,
                units(input.totalValue),
                units(input.maxYield),
                BigInt(input.tokenSupply),
                BigInt(Math.floor(new Date(input.saleDeadline).getTime() / 1000)),
                ms.map((m) => BigInt(Math.floor(new Date(m.deadline).getTime() / 1000))),
                ms.map((m) => m.weightBps),
              ]),
            ),
          "Effort dibuat onchain.",
        );
        return { ...res, id: res.ok ? String(before + 1) : undefined };
      },

      submitEvidence: (effortId, milestoneId, ev) =>
        tx(
          (_me, send) => send(call("submitEvidence", [BigInt(effortId), idx(milestoneId), ev.cid, ev.hash as Hex])),
          "Bukti tercatat di Jejak.",
        ),

      vote: (effortId, milestoneId, approve) =>
        tx((_me, send) => send(call("vote", [BigInt(effortId), idx(milestoneId), approve])), "Suara tercatat."),

      list: (effortId, amount, price) =>
        tx((_me, send) => send(call("list", [BigInt(effortId), BigInt(amount), units(price)])), "Listing jual dibuat."),

      cancelListing: (listingId) =>
        tx((_me, send) => send(call("cancelListing", [lid(listingId)])), "Listing dibatalkan."),

      buyListing: (listingId) =>
        tx(async (me, send) => {
          const l = state.listings.find((x) => x.id === listingId);
          if (!l) throw new Error("Listing tidak ditemukan.");
          await ensureAllowance(me, units(l.price) * BigInt(l.amount), send);
          return send(call("fillListing", [lid(listingId)]));
        }, "Berhasil membeli token dari pasar sekunder."),

      refund: (effortId) => tx((_me, send) => send(call("refund", [BigInt(effortId)])), "Refund diterima."),

      depositRevenue: (effortId, amount) =>
        tx(async (me, send) => {
          const e = find(effortId);
          const pool = Math.min(amount, e?.maxYield ?? amount);
          await ensureAllowance(me, units(pool), send);
          return send(call("depositRevenue", [BigInt(effortId), units(amount)]));
        }, "Hasil disetor."),

      claim: (effortId) => tx((_me, send) => send(call("claim", [BigInt(effortId)])), "Hasil berhasil diklaim."),

      faucet: () => {
        void tx((_me, send) => send({ address: IDR!, abi: idrAbi, functionName: "faucet", args: [units(100_000_000)] }), "Faucet: +Rp100.000.000 MockIDR.");
      },

      reset: () => {
        void refresh();
      },
    };
  }, [state, now, query, toast, refresh]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

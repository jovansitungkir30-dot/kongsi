"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { rupiah } from "@/lib/format";
import { MODE_KEY } from "./Providers";

const NAV = [
  { href: "/", label: "Jelajahi Effort", highlight: true },
  { href: "/effort-saya", label: "Effort Saya" },
  { href: "/portofolio", label: "Portofolio Token" },
  { href: "/pasar", label: "Pasar Sekunder" },
  { href: "/cara-kerja", label: "Cara Kerja & Risiko" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, switchUser, query, setQuery, toast, faucet, reset, mode, chainAvailable, connect } = useStore();
  const connected = state.me !== "tidak-terhubung";
  const pathname = usePathname();
  const router = useRouter();
  const me = state.users[state.me];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold text-brand-700">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">K</span>
          Kongsi
        </Link>
        <input
          className="input max-w-md"
          placeholder="Cari effort, pemilik, kategori..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (pathname !== "/") router.push("/");
          }}
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">{rupiah(me.balance)}</span>
          <button className="btn-ghost" onClick={faucet} title="Tambah saldo MockIDR">
            Faucet
          </button>
          {mode === "chain" ? (
            <button className="btn-buy" onClick={connect}>
              {connected ? me.name : "Hubungkan wallet"}
            </button>
          ) : (
            <select
              className="input w-48"
              value={state.me}
              onChange={(e) => switchUser(e.target.value)}
              aria-label="Akun demo"
            >
              {Object.values(state.users).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          )}
          <button
            className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${
              mode === "chain" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
            disabled={!chainAvailable}
            title={chainAvailable ? "Ganti mode data" : "Set NEXT_PUBLIC_KONGSI_ADDRESS untuk mode onchain"}
            onClick={() => {
              try {
                localStorage.setItem(MODE_KEY, mode === "chain" ? "demo" : "chain");
              } catch {}
              window.location.reload();
            }}
          >
            {mode === "chain" ? "Onchain · Sepolia" : "Mode Demo"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3">
          <ul className="space-y-1">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" || pathname.startsWith("/effort/") : pathname.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-brand-500 text-white"
                        : n.highlight
                          ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button className="mt-6 w-full text-left text-xs text-slate-400 hover:text-slate-600" onClick={reset}>
            {mode === "chain" ? "Muat ulang data" : "Reset data demo"}
          </button>
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

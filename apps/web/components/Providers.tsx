"use client";

import { useEffect, useState } from "react";
import { StoreProvider } from "@/lib/store";
import { ChainStoreProvider } from "@/lib/chain-store";

export const MODE_KEY = "kongsi-mode";

/** Pilih sumber data: demo (mock di browser) atau onchain (kontrak di testnet). */
export function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"demo" | "chain" | null>(null);

  useEffect(() => {
    let m: "demo" | "chain" = "demo";
    try {
      if (process.env.NEXT_PUBLIC_KONGSI_ADDRESS && localStorage.getItem(MODE_KEY) === "chain") m = "chain";
    } catch {}
    setMode(m);
  }, []);

  if (!mode) return null;
  return mode === "chain" ? (
    <ChainStoreProvider>{children}</ChainStoreProvider>
  ) : (
    <StoreProvider>{children}</StoreProvider>
  );
}

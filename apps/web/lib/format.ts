export const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export function rupiahShort(n: number) {
  const f = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  if (n >= 1e9) return `Rp${f(n / 1e9)} M`;
  if (n >= 1e6) return `Rp${f(n / 1e6)} jt`;
  return rupiah(n);
}

export const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

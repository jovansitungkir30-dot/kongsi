export default function CaraKerjaPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold">Cara Kerja & Risiko</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Alur</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Pemilik membuat effort: target, milestone bertenggat, nilai tokenisasi, max yield, jumlah dan harga token.</li>
          <li>Investor membeli token. Effort baru berjalan setelah seluruh token terjual.</li>
          <li>Pemilik mengunggah bukti tiap milestone ke Jejak; pemegang token memberi suara untuk memverifikasi.</li>
          <li>Token bisa dijual ke investor lain lewat pasar sekunder sampai milestone terakhir tercapai.</li>
          <li>Milestone akhir tercapai: hasil dibagi pro-rata per token, dibatasi max yield.</li>
          <li>Milestone tidak terpenuhi sebelum tenggat: token hangus, dana yang belum dicairkan dikembalikan.</li>
        </ol>
      </section>

      <section className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h2 className="text-lg font-bold text-amber-900">Risiko dan batasan</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          <li>Kongsi adalah platform patungan modal. Investasi mengandung risiko kehilangan sebagian atau seluruh dana.</li>
          <li>Dana dicairkan bertahap per milestone; hanya sisa dana yang belum dicairkan yang dapat direfund.</li>
          <li>Hasil tidak dijamin dan dibatasi max yield.</li>
          <li>Verifikasi dilakukan oleh voting pemegang token, bukan lembaga independen.</li>
          <li>Versi ini adalah demo hackathon: tanpa KYC dan tanpa uang sungguhan (MockIDR).</li>
        </ul>
      </section>
    </article>
  );
}

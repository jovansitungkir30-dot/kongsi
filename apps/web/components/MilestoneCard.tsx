"use client";

import { useState } from "react";
import type { Effort, Milestone } from "@/lib/types";
import { useStore } from "@/lib/store";
import { phaseOf, voteWeight } from "@/lib/logic";
import { sha256Hex, tanggal } from "@/lib/format";

export function MilestoneCard({ effort: e, milestone: m, index }: { effort: Effort; milestone: Milestone; index: number }) {
  const { state, now, submitEvidence, vote } = useStore();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const phase = phaseOf(e, now);
  const expired = m.status !== "verified" && new Date(m.deadline).getTime() < now && e.sold >= e.tokenSupply;
  const isOwner = state.me === e.ownerId;
  const prevDone = e.milestones.slice(0, index).every((p) => p.status === "verified");
  const weight = voteWeight(m, state.me);

  const badge = expired || m.status === "rejected"
    ? { text: m.status === "rejected" ? "Ditolak" : "Lewat tenggat", cls: "bg-rose-100 text-rose-800" }
    : m.status === "verified"
      ? { text: "Terverifikasi", cls: "bg-emerald-100 text-emerald-800" }
      : m.status === "submitted"
        ? { text: "Menunggu voting", cls: "bg-amber-100 text-amber-800" }
        : { text: "Belum", cls: "bg-slate-100 text-slate-600" };

  async function upload() {
    if (!file) return;
    setBusy(true);
    const hash = await sha256Hex(`${file.name}:${file.size}:${file.lastModified}:${note}`);
    submitEvidence(e.id, m.id, {
      fileName: file.name,
      note,
      hash: `0x${hash}`,
      cid: `bafy${hash.slice(0, 40)}`,
      uploadedAt: new Date().toISOString(),
    });
    setBusy(false);
    setOpen(false);
    setFile(null);
    setNote("");
  }

  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold leading-snug">
          {index + 1}. {m.title}
        </h4>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Tenggat {tanggal(m.deadline)} · pencairan {m.weightBps / 100}%
      </p>
      <p className="mt-2 text-sm text-slate-600">{m.description}</p>

      {m.evidence && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-700">📎 {m.evidence.fileName}</p>
          <p className="mt-1 text-slate-600">{m.evidence.note}</p>
          <p className="mt-1 text-slate-400">Diunggah {tanggal(m.evidence.uploadedAt)}</p>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-400">CID {m.evidence.cid}</p>
          <p className="break-all font-mono text-[10px] text-slate-400">Hash {m.evidence.hash}</p>
        </div>
      )}

      {m.status === "submitted" && (
        <div className="mt-3 text-xs text-slate-600">
          Suara setuju {m.yes}/{e.tokenSupply} · tolak {m.no}/{e.tokenSupply}
          {weight > 0 && !m.voted[state.me] && !expired && (
            <div className="mt-2 flex gap-2">
              <button className="btn-buy !py-1" onClick={() => vote(e.id, m.id, true)}>
                Setuju ({weight} token)
              </button>
              <button className="btn-ghost !py-1" onClick={() => vote(e.id, m.id, false)}>
                Tolak
              </button>
            </div>
          )}
          {m.voted[state.me] && <p className="mt-1 text-emerald-700">Anda sudah memberi suara.</p>}
        </div>
      )}

      {isOwner && m.status === "pending" && phase === "running" && prevDone && !expired && (
        <div className="mt-3">
          {!open ? (
            <button className="btn-ghost !py-1" onClick={() => setOpen(true)}>
              Unggah bukti
            </button>
          ) : (
            <div className="space-y-2">
              <input type="file" className="text-xs" onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} />
              <textarea
                className="input"
                rows={2}
                placeholder="Keterangan bukti"
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn-buy !py-1" disabled={!file || busy} onClick={upload}>
                  Catat di Jejak
                </button>
                <button className="btn-ghost !py-1" onClick={() => setOpen(false)}>
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

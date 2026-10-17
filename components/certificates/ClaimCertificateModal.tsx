"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claimCertificateAction } from "@/app/(app)/certificates/actions";

interface ClaimCertificateModalProps {
  trackId: string;
  trackTitle: string;
  level: string;
  defaultName?: string;
  triggerLabel?: string;
}

export function ClaimCertificateModal({
  trackId,
  trackTitle,
  level,
  defaultName = "",
  triggerLabel = "Claim Certificate",
}: ClaimCertificateModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = () => {
    setError(null);
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await claimCertificateAction({
        trackId,
        level,
        nameAsChosen: name,
      });

      if (result.success) {
        closeModal();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim certificate. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-cyan bg-cyan/15 hover:bg-cyan/25 text-cyan font-ui text-sm font-semibold tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <span>{triggerLabel}</span>
        <span aria-hidden="true">→</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="claim-cert-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface-raised p-0 text-ink shadow-2xl backdrop:bg-void/80"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5 font-sans text-sm">
          <div className="border-b border-line/60 pb-3">
            <h2 id="claim-cert-title" className="font-display text-lg font-bold uppercase tracking-tight text-ink">
              Claim Certificate of Completion
            </h2>
            <p className="mt-1 text-xs text-secondary">
              {trackTitle} · Classification: <span className="text-cyan font-mono font-semibold">{level}</span>
            </p>
          </div>

          <div>
            <label htmlFor="display-name-input" className="block font-ui text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Recipient Display Name
            </label>
            <input
              id="display-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              required
              minLength={2}
              maxLength={60}
              className="w-full rounded-xs border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan font-sans"
            />
            <p className="mt-1 text-[11px] text-muted">
              Choose your legal or professional name as you want it permanently printed on your official verified certificate.
            </p>
          </div>

          {error && (
            <div className="rounded-xs border border-danger/60 bg-danger/10 p-3 text-xs text-danger" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/60">
            <button
              type="button"
              onClick={closeModal}
              disabled={busy}
              className="min-h-[44px] px-4 rounded-xs border border-line bg-surface hover:bg-surface-hover text-secondary font-ui text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className="min-h-[44px] px-5 rounded-xs border border-cyan bg-cyan hover:bg-cyan-hover text-void font-ui text-sm font-bold tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-50 transition-colors"
            >
              {busy ? "Issuing Credential…" : "Issue Certificate"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

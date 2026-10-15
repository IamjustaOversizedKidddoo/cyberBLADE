"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startSocExamAction } from "@/app/(app)/labs/soc/exams/actions";

/** Start with a confirmation step: the clock starts on the server the moment the exam is created. */
export function StartExamButton({ format, title, minutes, disabled }: { format: string; title: string; minutes: number; disabled: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const s = await startSocExamAction(format);
      router.push(`/labs/soc/exams/${s.examId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the exam.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => dialogRef.current?.showModal()} className="min-h-[44px] rounded-xs border border-cyan bg-cyan/15 px-4 font-ui text-sm font-semibold text-cyan hover:bg-cyan/25 disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted">
        Start {title.toLowerCase()}
      </button>
      <dialog ref={dialogRef} aria-labelledby={`start-${format}`} className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface-raised p-0 text-ink backdrop:bg-void/80">
        <div className="space-y-4 p-5 font-sans text-sm">
          <h2 id={`start-${format}`} className="font-ui text-base">Start {title.toLowerCase()} now?</h2>
          <p className="text-secondary">You&apos;ll have {minutes} minutes from the moment you start. The clock runs on our server and can&apos;t be paused or restarted, and this counts as one attempt.</p>
          {error && <p role="alert" className="text-ink">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="min-h-[44px] rounded-xs border border-line px-4 font-ui text-ink hover:bg-surface-hover">Not yet</button>
            <button type="button" onClick={start} disabled={busy} className="min-h-[44px] rounded-xs border border-cyan bg-cyan/20 px-4 font-ui font-semibold text-cyan hover:bg-cyan/30 disabled:opacity-50">{busy ? "Starting…" : "Start the clock"}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

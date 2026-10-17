"use client";

import { useRef, useState } from "react";
import { deleteAccountAction, exportUserDataAction } from "@/lib/identity/privacy-actions";

/** Export (downloads a JSON file) and permanent deletion with a confirmation step. */
export function AccountDataControls() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function exportData() {
    setBusy(true);
    setStatus("Preparing your export…");
    try {
      const data = await exportUserDataAction();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `cyberblade-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Your export has been downloaded.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed. Please try again later.");
    } finally {
      // 2-second debounce prevents accidental multi-stream clicks (A-06)
      setTimeout(() => setBusy(false), 2000);
    }
  }

  const isConfirmed = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="space-y-8">
      <section aria-labelledby="export-h" className="rounded-xs border border-line bg-surface p-5">
        <h2 id="export-h" className="font-ui text-base text-ink">Export your data</h2>
        <p className="mt-2 max-w-prose text-secondary">A JSON file with your profile, progress, answers, reports, exam results, feedback and notice acknowledgements. It leaves out answer keys and internal values used to generate exercises.</p>
        <button type="button" onClick={exportData} disabled={busy} className="mt-3 min-h-[44px] rounded-xs border border-cyan bg-cyan/15 px-4 font-ui text-sm text-cyan hover:bg-cyan/25 disabled:opacity-50 transition-colors">
          {busy ? "Preparing export…" : "Download my data"}
        </button>
        <p role="status" className="mt-2 text-sm text-secondary">{status}</p>
      </section>

      <section aria-labelledby="delete-h" className="rounded-xs border border-danger/50 bg-surface p-5">
        <h2 id="delete-h" className="font-ui text-base text-ink">Delete your account</h2>
        <p className="mt-2 max-w-prose text-secondary">This permanently deletes your account, progress, answers, reports, exam results and feedback. It cannot be undone. Export first if you want a copy.</p>
        <button type="button" onClick={() => dialog.current?.showModal()} className="mt-3 min-h-[44px] rounded-xs border border-danger px-4 font-ui text-sm text-ink hover:bg-danger/15 transition-colors">
          Delete my account…
        </button>
      </section>

      <dialog ref={dialog} aria-labelledby="del-title" className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface-raised p-0 text-ink backdrop:bg-void/80">
        <form action={deleteAccountAction} className="space-y-3 p-5 font-sans text-sm">
          <h2 id="del-title" className="font-ui text-base">Delete your account permanently?</h2>
          <label htmlFor="del-confirm" className="block text-secondary">Type DELETE to confirm (case-insensitive).</label>
          <input
            id="del-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            autoComplete="off"
            className="w-full min-h-[44px] rounded-xs border border-line bg-void px-3 text-ink focus-visible:outline-2 focus-visible:outline-cyan"
          />
          {confirmText.length > 0 && !isConfirmed && (
            <p className="text-xs text-warning">
              Must match &quot;DELETE&quot; (case-insensitive).
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus onClick={() => dialog.current?.close()} className="min-h-[44px] rounded-xs border border-line px-4 font-ui text-ink hover:bg-surface-hover">Keep my account</button>
            <button type="submit" disabled={!isConfirmed} className="min-h-[44px] rounded-xs border border-danger bg-danger/20 px-4 font-ui font-semibold text-ink disabled:opacity-40">Delete permanently</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

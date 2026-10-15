"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExamStateView } from "@/lib/lab-engine/soc/exam/service";
import type { SocSessionClient } from "@/lib/lab-engine/soc/types";
import { getSocExamStateAction, saveSocExamHandoffAction, submitSocExamAction } from "@/app/(app)/labs/soc/exams/actions";
import { getSocSessionAction } from "@/app/(app)/labs/soc/actions";
import { SocWorkspace } from "@/components/labs/soc/SocWorkspace";
import { ExamTimerHud } from "./ExamTimerHud";
import { KnowledgeItemsForm } from "./KnowledgeItemsForm";
import { BUDGET_NAMES } from "./format";

const HANDOFF_MAX = 3000;

export function ExamRunner({ initial }: { initial: ExamStateView }) {
  const router = useRouter();
  const [session, setSession] = useState<SocSessionClient | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(initial.handoffNote ?? "");
  const [handoffStatus, setHandoffStatus] = useState<string>(initial.handoffNote ? "Saved earlier" : "Not saved yet");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const header = document.querySelector("body header");
    if (!header) return;
    const ro = new ResizeObserver(() => setHeaderHeight(header.getBoundingClientRect().height));
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!initial.socAttemptId) return;
    getSocSessionAction(initial.socAttemptId)
      .then(setSession)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load the exam workspace."));
  }, [initial.socAttemptId]);

  const finish = useCallback(async () => {
    setClosed(true);
    try {
      await getSocExamStateAction(initial.examId); // the server submits an expired exam on this read
    } finally {
      router.refresh();
    }
  }, [initial.examId, router]);

  async function saveHandoff() {
    setHandoffStatus("Saving…");
    try {
      await saveSocExamHandoffAction(initial.examId, handoff);
      setHandoffStatus(`Saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch (e) {
      setHandoffStatus(e instanceof Error ? e.message : "Not saved — try again");
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (initial.format === "alert-queue" && handoff !== (initial.handoffNote ?? "")) await saveSocExamHandoffAction(initial.examId, handoff).catch(() => undefined);
      await submitSocExamAction(initial.examId);
      setClosed(true);
      dialogRef.current?.close();
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const openConfirm = () => dialogRef.current?.showModal();
  const budgets = Object.entries(initial.budgets);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-canvas">
      {/* Sticks just below the site header (z below it), so it never covers the navigation. */}
      <div className="sticky z-[2]" style={{ top: headerHeight }}>
        <ExamTimerHud examId={initial.examId} deadlineAt={initial.deadlineAt} serverNow={initial.serverNow} onExpired={finish} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-3">
        <div>
          <h1 className="font-ui text-base text-ink">{initial.title}</h1>
          <p className="font-sans text-xs text-muted">
            Practice exam · unproctored · not equivalent to any real exam{initial.timeMultiplier !== 1 ? ` · extended time ×${initial.timeMultiplier}` : ""}
          </p>
        </div>
        {budgets.length > 0 && (
          <p className="font-ui text-xs text-secondary">
            Limits: {budgets.map(([k, b]) => `${BUDGET_NAMES[k] ?? k} ${b!.limit}`).join(" · ")} (each use counts)
          </p>
        )}
        {initial.format === "knowledge" && (
          <button type="button" onClick={openConfirm} disabled={closed} className="min-h-[44px] rounded-xs border border-cyan bg-cyan/20 px-4 font-ui text-sm font-semibold text-cyan hover:bg-cyan/30 disabled:opacity-50">
            Submit exam
          </button>
        )}
      </div>

      {initial.format === "alert-queue" && (
        <details className="border-b border-line bg-surface px-4 py-3" open>
          <summary className="min-h-[44px] cursor-pointer font-ui text-sm text-ink">Handoff note (scored for completeness)</summary>
          <label htmlFor="handoff" className="mt-2 block font-sans text-sm text-secondary">
            Write the note for the next shift: what you escalated or closed (with alert IDs and severity), what is still open, and the next step.
          </label>
          <textarea
            id="handoff"
            value={handoff}
            maxLength={HANDOFF_MAX}
            onChange={(e) => setHandoff(e.target.value)}
            onBlur={saveHandoff}
            disabled={closed}
            rows={4}
            className="mt-2 w-full rounded-xs border border-line bg-void p-3 font-sans text-sm text-ink focus:border-cyan focus:outline-none"
            aria-describedby="handoff-status"
          />
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveHandoff} disabled={closed} className="min-h-[44px] rounded-xs border border-line bg-surface-raised px-3 font-ui text-xs text-ink hover:bg-surface-hover sm:min-h-[32px]">
              Save note
            </button>
            <span id="handoff-status" className="font-ui text-xs text-muted">
              {handoffStatus} · {handoff.length}/{HANDOFF_MAX}
            </span>
          </div>
        </details>
      )}

      <div className="flex-1">
        {initial.format === "knowledge" && initial.knowledgeItems && <KnowledgeItemsForm examId={initial.examId} items={initial.knowledgeItems} disabled={closed} />}
        {initial.socAttemptId &&
          (loadError ? (
            <p role="alert" className="m-4 rounded-xs border border-danger/40 bg-danger/10 p-4 text-sm text-ink">
              {loadError}
            </p>
          ) : session ? (
            <SocWorkspace session={session} exam={{ onRequestSubmit: openConfirm, searchEnabled: initial.searchEnabled }} />
          ) : (
            <p className="p-6 font-ui text-sm text-muted" role="status">
              Loading the exam workspace…
            </p>
          ))}
      </div>

      <dialog ref={dialogRef} aria-labelledby="submit-exam-title" className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface-raised p-0 text-ink backdrop:bg-void/80">
        <div className="space-y-4 p-5">
          <h2 id="submit-exam-title" className="font-ui text-base">
            Submit your exam?
          </h2>
          <ul className="list-disc space-y-1 pl-5 font-sans text-sm text-secondary">
            <li>You can&apos;t change any answer after submitting.</li>
            <li>Your score, debriefs and model answers appear straight after, for you only.</li>
            {initial.format === "alert-queue" && <li>Your handoff note is saved with the exam.</li>}
            {initial.format === "investigation" && <li>Your latest saved report draft is graded. Save it first if you changed it.</li>}
          </ul>
          {submitError && (
            <p role="alert" className="text-sm text-ink">
              {submitError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} disabled={submitting} className="min-h-[44px] rounded-xs border border-line px-4 font-ui text-sm text-ink hover:bg-surface-hover">
              Keep working
            </button>
            <button type="button" onClick={submit} disabled={submitting} className="min-h-[44px] rounded-xs border border-cyan bg-cyan/20 px-4 font-ui text-sm font-semibold text-cyan hover:bg-cyan/30 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit exam"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { requestLabHintAction } from "@/app/(app)/handler/actions";
import { IconCheck, IconPlay } from "@/components/ui/icons";

export type Objective = { id: string; prompt: string; solved: boolean };
export type SubmitResult = { correct: boolean; labCompleted?: boolean; passed?: boolean; expired?: boolean };

type Props = {
  objectives: Objective[];
  solved: ReadonlySet<string>;
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
  status: string;
  continueTo?: { href: string; label: string } | null;
  attemptId?: string;
};

type HintDisplay = {
  tier: number;
  totalTiers: number;
  hintText: string;
};

/** Answer boxes for each objective. State lives in LabWorkspace (the terminal can submit too). */
export function ObjectivesPanel({ objectives, solved, onSubmit, status, continueTo, attemptId }: Props) {
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<string, HintDisplay>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [hintPending, setHintPending] = useState<string | null>(null);

  async function submit(id: string, form: HTMLFormElement) {
    if (pending || solved.has(id)) return;
    const answer = String(new FormData(form).get("answer") ?? "");
    if (!answer.trim()) {
      setFeedback((f) => ({ ...f, [id]: "Type an answer first." }));
      return;
    }
    setPending(id);
    try {
      const r = await onSubmit(id, answer);
      if (!r.expired) setFeedback((f) => ({ ...f, [id]: r.correct ? "Correct" : "Not quite — keep digging." }));
    } catch {
      setFeedback((f) => ({ ...f, [id]: "Could not check that. Try again." }));
    } finally {
      setPending(null);
    }
  }

  async function requestHint(objectiveId: string) {
    if (!attemptId || hintPending) return;
    setHintPending(objectiveId);
    try {
      const progression = await requestLabHintAction(attemptId, objectiveId);
      setHints((h) => ({
        ...h,
        [objectiveId]: {
          tier: progression.tier,
          totalTiers: progression.totalTiers,
          hintText: progression.hintText,
        },
      }));
    } catch {
      setFeedback((f) => ({ ...f, [objectiveId]: "No additional hints available." }));
    } finally {
      setHintPending(null);
    }
  }

  const solvedCount = objectives.filter((o) => solved.has(o.id)).length;

  return (
    <section aria-labelledby="objectives-heading" className="space-y-4">
      <h2 id="objectives-heading" className="sr-only">
        objectives
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <span aria-hidden="true" className="font-ui text-base font-bold tracking-wider text-ink uppercase">
          objectives
        </span>
        <span className="font-ui text-xs text-cyan border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 rounded-xs font-semibold">
          {solvedCount} / {objectives.length} SOLVED
        </span>
      </div>

      <p className="font-ui text-xs text-muted">
        Answer below, or straight from the terminal: <code className="font-mono text-cyan bg-surface-raised px-1.5 py-0.5 rounded-xs border border-line/60">submit 1 your-answer</code>
      </p>

      <ol className="space-y-3.5">
        {objectives.map((o, i) => {
          const isSolved = solved.has(o.id);
          return (
            <li
              key={o.id}
              className={`rounded-sm border p-4.5 transition-all ${
                isSolved
                  ? "border-success/40 bg-surface shadow-[0_0_15px_rgba(16,185,129,0.06)]"
                  : "border-line bg-surface hover:border-line/80"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p className="text-ink font-sans text-sm font-medium">
                  <span className="font-mono text-xs text-muted font-bold mr-1.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {o.prompt}
                </p>
                {attemptId && !isSolved && (
                  <button
                    type="button"
                    disabled={hintPending === o.id}
                    onClick={() => requestHint(o.id)}
                    className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 font-ui text-[11px] text-muted hover:border-purple hover:text-purple transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple"
                  >
                    {hintPending === o.id
                      ? "[Requesting hint...]"
                      : hints[o.id]
                      ? `[Hint Tier ${hints[o.id].tier}/${hints[o.id].totalTiers} → Next]`
                      : "[Request Hint]"}
                  </button>
                )}
              </div>

              {hints[o.id] && !isSolved && (
                <div className="mb-3 rounded-xs border-l-4 border-l-purple border-y border-r border-line/40 bg-purple/10 p-3 font-mono text-xs text-ink">
                  <span className="font-ui text-purple font-bold tracking-wider">
                    HINT // TIER {hints[o.id].tier} OF {hints[o.id].totalTiers}:{" "}
                  </span>
                  {hints[o.id].hintText}
                </div>
              )}

              {isSolved ? (
                <p className="font-ui text-xs font-semibold text-success flex items-center gap-1.5 mt-2">
                  <IconCheck className="h-4 w-4" />
                  <span>✓ Solved</span>
                </p>
              ) : (
                <form
                  className="flex flex-wrap gap-2 mt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit(o.id, e.currentTarget);
                  }}
                >
                  <label className="sr-only" htmlFor={`answer-${o.id}`}>
                    Answer for objective {i + 1}
                  </label>
                  <input
                    id={`answer-${o.id}`}
                    name="answer"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Enter discovered value..."
                    className="min-w-0 flex-1 rounded-xs border border-line bg-surface-subtle px-3 py-1.5 font-mono text-xs text-ink placeholder:text-muted/40 focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                  />
                  <button
                    type="submit"
                    disabled={pending !== null}
                    aria-busy={pending === o.id}
                    className="inline-flex items-center justify-center rounded-xs border border-cyan/60 bg-cyan/15 px-4 py-1.5 font-ui text-xs font-semibold tracking-wider text-cyan hover:bg-cyan hover:text-void transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  >
                    {pending === o.id ? "Checking..." : "Submit"}
                  </button>
                </form>
              )}

              {feedback[o.id] && !isSolved && (
                <p role="alert" className="mt-2 font-ui text-xs text-amber-400">
                  {feedback[o.id]}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {status && (
        <p role="status" className="rounded-sm border border-purple/40 bg-purple/10 p-4 font-ui text-xs text-purple font-semibold shadow-[0_0_15px_rgba(200,60,255,0.15)] flex items-center gap-2">
          <IconCheck className="h-4 w-4" />
          <span>{status}</span>
        </p>
      )}

      {status && continueTo && (
        <div className="pt-2">
          <Link
            href={continueTo.href}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xs border-2 border-cyan bg-cyan px-6 py-2.5 font-ui text-sm font-bold tracking-wider text-void shadow-[0_0_15px_rgba(15,190,255,0.4)] hover:bg-cyan/90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            <IconPlay className="h-4 w-4" />
            <span>{continueTo.label}</span>
          </Link>
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { requestLabHintAction } from "@/app/(app)/handler/actions";

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

  return (
    <section aria-labelledby="objectives-heading" className="space-y-4">
      <h2 id="objectives-heading" className="text-3xl">
        objectives
      </h2>
      <p className="text-sm text-muted">
        Answer below, or straight from the terminal: <code className="font-mono text-ink">submit 1 your-answer</code>
      </p>
      <ol className="space-y-4">
        {objectives.map((o, i) => (
          <li key={o.id} className={`border p-4 ${solved.has(o.id) ? "border-cyan" : "border-line"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <p className="text-ink">
                <span className="font-ui text-muted">{String(i + 1).padStart(2, "0")} </span>
                {o.prompt}
              </p>
              {attemptId && !solved.has(o.id) && (
                <button
                  type="button"
                  disabled={hintPending === o.id}
                  onClick={() => requestHint(o.id)}
                  className="border border-line bg-void/50 px-2.5 py-0.5 font-ui text-xs text-muted hover:border-purple hover:text-purple disabled:opacity-40"
                >
                  {hintPending === o.id
                    ? "[Requesting hint...]"
                    : hints[o.id]
                    ? `[Hint Tier ${hints[o.id].tier}/${hints[o.id].totalTiers} → Next]`
                    : "[Request Hint]"}
                </button>
              )}
            </div>

            {hints[o.id] && !solved.has(o.id) && (
              <div className="mb-3 border-l-2 border-purple bg-purple/10 p-2.5 font-mono text-xs text-ink">
                <span className="font-ui text-purple font-bold">
                  HINT // TIER {hints[o.id].tier} OF {hints[o.id].totalTiers}:{" "}
                </span>
                {hints[o.id].hintText}
              </div>
            )}

            {solved.has(o.id) ? (
              <p className="font-ui text-cyan">✓ Solved</p>
            ) : (
              <form
                className="flex flex-wrap gap-2"
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
                  className="min-w-0 flex-1 border border-line bg-void px-3 py-1.5 font-mono text-sm text-ink focus:border-cyan"
                />
                <button
                  type="submit"
                  disabled={pending === o.id}
                  className="border border-cyan px-4 py-1 text-cyan hover:bg-cyan hover:text-void disabled:opacity-40"
                >
                  Submit
                </button>
              </form>
            )}
            {feedback[o.id] && !solved.has(o.id) && (
              <p role="alert" className="mt-2 text-sm text-pink">
                {feedback[o.id]}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p role="status" className="font-ui text-purple">
        {status}
      </p>
      {status && continueTo && (
        <Link href={continueTo.href} className="inline-block border border-cyan bg-cyan px-6 py-2 font-ui text-lg text-void hover:bg-transparent hover:text-cyan">
          {continueTo.label}
        </Link>
      )}
    </section>
  );
}

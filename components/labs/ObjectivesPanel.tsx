"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Objective = { id: string; prompt: string; solved: boolean };
export type SubmitResult = { correct: boolean; labCompleted?: boolean; passed?: boolean; expired?: boolean };

type Props = {
  objectives: Objective[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
  doneMessage?: string;
};

export function ObjectivesPanel({ objectives, onSubmit, doneMessage = "Lab complete! XP added to your profile." }: Props) {
  const router = useRouter();
  const [solved, setSolved] = useState(() => new Set(objectives.filter((o) => o.solved).map((o) => o.id)));
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(objectives.every((o) => o.solved) ? doneMessage : "");
  const [pending, setPending] = useState<string | null>(null);

  async function submit(id: string, form: HTMLFormElement) {
    const answer = String(new FormData(form).get("answer") ?? "");
    if (!answer.trim()) {
      setFeedback((f) => ({ ...f, [id]: "Type an answer first." }));
      return;
    }
    setPending(id);
    try {
      const r = await onSubmit(id, answer);
      if (r.expired) {
        setStatus("Time is up — this attempt has ended.");
        router.refresh();
        return;
      }
      setFeedback((f) => ({ ...f, [id]: r.correct ? "Correct" : "Not quite — keep digging." }));
      if (r.correct) setSolved((s) => new Set(s).add(id));
      if (r.labCompleted || r.passed) {
        setStatus(doneMessage);
        router.refresh();
      }
    } catch {
      setFeedback((f) => ({ ...f, [id]: "Could not check that. Try again." }));
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="objectives-heading" className="space-y-4">
      <h2 id="objectives-heading" className="text-3xl">
        objectives
      </h2>
      <ol className="space-y-4">
        {objectives.map((o, i) => (
          <li key={o.id} className={`border p-4 ${solved.has(o.id) ? "border-cyan" : "border-line"}`}>
            <p className="mb-3 text-ink">
              <span className="font-ui text-muted">{String(i + 1).padStart(2, "0")} </span>
              {o.prompt}
            </p>
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
    </section>
  );
}

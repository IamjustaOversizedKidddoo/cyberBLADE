"use client";

import { useState } from "react";
import type { PublicQuestion } from "@/lib/content/checks";
import { IconCheck, IconAlertTriangle, IconRotateCcw } from "@/components/ui/icons";

export type CheckResult = { correct: boolean; explanations: string[]; lessonCompleted: boolean };

/** "terminal" (default, core lessons) uses uppercase legends; "readable" (opt-in, SOC track) uses sentence case. */
export type CheckVariant = "terminal" | "readable";

type Props = {
  questions: PublicQuestion[];
  initialPassed: string[];
  answer: (questionId: string, optionIndex: number) => Promise<CheckResult>;
  variant?: CheckVariant;
};

const LEGEND_CLASS: Record<CheckVariant, string> = {
  terminal: "px-2 font-ui text-sm font-semibold tracking-wide text-ink uppercase",
  readable: "px-2 font-sans text-[15px] font-semibold leading-snug text-ink",
};

function Question({
  q,
  passed,
  answer,
  onResult,
  variant,
}: {
  q: PublicQuestion;
  passed: boolean;
  answer: Props["answer"];
  onResult: (r: CheckResult) => void;
  variant: CheckVariant;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  async function check() {
    if (choice === null) return;
    setPending(true);
    setError(null);
    try {
      const r = await answer(q.id, choice);
      setResult(r);
      setAttempts((n) => n + 1);
      onResult(r);
    } catch {
      setError("Could not check your answer. Try again.");
    } finally {
      setPending(false);
    }
  }

  const isAnswered = result !== null;
  const isCorrect = result?.correct ?? false;

  return (
    <fieldset
      className={`rounded-sm border p-5 transition-all ${
        passed || isCorrect
          ? "border-success/40 bg-surface shadow-[0_0_15px_rgba(16,185,129,0.06)]"
          : isAnswered && !isCorrect
          ? "border-amber-500/40 bg-surface shadow-[0_0_15px_rgba(245,158,11,0.06)]"
          : "border-line bg-surface"
      }`}
      data-attempts={attempts}
      data-result={pending ? "pending" : result ? (result.correct ? "correct" : "wrong") : "idle"}
    >
      <legend className={LEGEND_CLASS[variant]}>
        {q.prompt}
      </legend>

      {passed && (
        <div className="mb-3 flex items-center gap-1.5 font-ui text-xs font-semibold text-success">
          <IconCheck className="h-3.5 w-3.5" />
          <span>Passed</span>
        </div>
      )}

      {/* Options list with comfortable hit targets */}
      <ul className="space-y-2.5 my-3">
        {q.options.map((text, i) => {
          const isSelected = choice === i;
          return (
            <li key={i} className="rounded-xs transition-colors">
              <label
                className={`flex items-start gap-3 p-3 rounded-xs border cursor-pointer select-none transition-all ${
                  isSelected
                    ? "border-cyan/60 bg-cyan/10 text-ink shadow-[0_0_10px_rgba(15,190,255,0.1)]"
                    : "border-line/60 bg-surface-subtle/50 text-ink/80 hover:border-line hover:bg-surface-raised"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  className="mt-0.5 h-4 w-4 accent-cyan cursor-pointer focus:ring-2 focus:ring-cyan"
                  checked={isSelected}
                  onChange={() => setChoice(i)}
                />
                <span className="font-sans text-sm leading-relaxed">{text}</span>
              </label>

              {result && (
                <div
                  className={`ml-7 mt-1.5 p-2 rounded-xs border text-xs font-sans leading-relaxed ${
                    i === choice
                      ? result.correct
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-line/40 bg-surface-subtle text-muted"
                  }`}
                >
                  <div className="font-semibold mb-0.5 font-ui">
                    {i === choice
                      ? result.correct
                        ? "WHY THIS IS CORRECT:"
                        : "WHY THIS DISTRACTOR IS INCORRECT:"
                      : "OPTION EXPLANATION:"}
                  </div>
                  {result.explanations[i]}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Productive-failure intervention after 5 attempts */}
      {attempts >= 5 && !isCorrect && (
        <div className="mt-4 p-3 rounded-xs border border-cyan/40 bg-cyan/5 text-xs font-sans space-y-2">
          <div className="font-ui font-semibold text-cyan uppercase tracking-wider flex items-center gap-1.5">
            <IconAlertTriangle className="h-4 w-4 text-cyan" />
            <span>Productive Failure Assistance</span>
          </div>
          <p className="text-secondary leading-relaxed">
            You&apos;ve attempted this check {attempts} times. Reviewing the core concepts or asking for a hint can help unlock the solution:
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 font-ui">
            <a
              href="#briefing"
              className="px-2.5 py-1 min-h-[36px] flex items-center rounded-xs border border-line bg-surface hover:border-cyan text-ink text-xs transition-colors"
            >
              📖 Re-read Section
            </a>
            <button
              type="button"
              onClick={() => {
                const trigger = document.querySelector<HTMLButtonElement>('[aria-controls="handler-drawer"]');
                trigger?.click();
              }}
              className="px-2.5 py-1 min-h-[36px] flex items-center rounded-xs border border-cyan/40 bg-cyan/15 hover:bg-cyan/25 text-cyan text-xs font-semibold transition-colors"
            >
              🤖 Get Hint from Handler
            </button>
            <span className="text-muted text-xs">or pause for a 5-minute break.</span>
          </div>
        </div>
      )}

      {/* Actions and verdict row */}
      <div className="mt-5 flex flex-wrap items-center gap-4 pt-3 border-t border-line/60">
        <button
          type="button"
          onClick={check}
          disabled={choice === null || pending}
          className="inline-flex items-center gap-2 rounded-xs border-2 border-cyan bg-cyan/10 px-5 py-1.5 font-ui text-xs font-bold tracking-wider text-cyan transition-all hover:bg-cyan hover:text-void disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          {pending ? (
            <span>Verifying...</span>
          ) : isAnswered && !isCorrect ? (
            <>
              <IconRotateCcw className="h-3 w-3" />
              <span>Check answer</span>
            </>
          ) : (
            <span>Check answer</span>
          )}
        </button>

        {result && (
          <span
            className={`inline-flex items-center gap-1.5 font-ui text-xs font-semibold px-2.5 py-0.5 rounded-xs border ${
              result.correct
                ? "border-success/40 bg-success/10 text-success"
                : "border-amber-500/40 bg-amber-500/10 text-amber-400"
            }`}
          >
            {result.correct ? (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                <span>Correct</span>
              </>
            ) : (
              <>
                <IconAlertTriangle className="h-3.5 w-3.5" />
                <span>Not quite</span>
              </>
            )}
          </span>
        )}

        {error && (
          <span role="alert" className="font-ui text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    </fieldset>
  );
}

/** Terminal Check: answers are graded on the server; the browser never has the answer key. */
export function TerminalCheck({ questions, initialPassed, answer, variant = "terminal" }: Props) {
  const [passed, setPassed] = useState(() => new Set(initialPassed));
  const [completed, setCompleted] = useState(false);

  return (
    <div className="not-prose my-8 space-y-5">
      <div className="flex items-center gap-2 border-b border-line/60 pb-2">
        <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_rgba(15,190,255,0.8)]" />
        <h4 className="font-ui text-xs tracking-widest text-cyan uppercase font-bold">
          TERMINAL KNOWLEDGE VERIFICATION
        </h4>
      </div>

      {questions.map((q) => (
        <Question
          key={q.id}
          q={q}
          passed={passed.has(q.id)}
          answer={answer}
          variant={variant}
          onResult={(r) => {
            if (r.correct) setPassed((s) => new Set(s).add(q.id));
            if (r.lessonCompleted) setCompleted(true);
          }}
        />
      ))}

      {completed && (
        <div
          role="status"
          className="rounded-sm border border-purple/50 bg-purple/10 p-4 font-ui text-sm text-purple font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(200,60,255,0.15)]"
        >
          <IconCheck className="h-4 w-4" />
          <span>Lesson complete! XP added to your profile.</span>
        </div>
      )}
    </div>
  );
}

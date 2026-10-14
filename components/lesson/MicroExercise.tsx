"use client";

import { useId, useState } from "react";
import type { PublicExercise, PublicExerciseQuestion } from "@/lib/content/exercises";
import type { ExerciseCheckResult } from "@/app/(app)/learn/exercise-actions";
import { LogBlock } from "./LogBlock";

type Check = (exerciseId: string, questionId: string, answer: string) => Promise<ExerciseCheckResult>;

const KIND_LABEL: Record<PublicExercise["kind"], string> = {
  "triage-queue": "Triage mini-queue",
  "header-analysis": "Header analysis",
  "log-reading": "Log reading",
  query: "Query",
  timeline: "Timeline",
  "report-section": "Report section",
};

function Question({ exerciseId, q, check }: { exerciseId: string; q: PublicExerciseQuestion; check: Check }) {
  const uid = useId();
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "correct" | "wrong" | "error">("idle");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) {
      setState("error");
      setMessage("Enter an answer first.");
      return;
    }
    setState("checking");
    try {
      const r = await check(exerciseId, q.id, answer);
      setTries((t) => t + 1);
      if (r.correct) {
        setState("correct");
        setExplanation(r.explanation);
        setMessage("Correct.");
      } else {
        setState("wrong");
        setMessage(tries + 1 >= 2 && hintsShown < q.hints.length ? "Not yet. A hint might help." : "Not yet. Look again and try another answer.");
      }
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Could not check your answer. Try again.");
    }
  };

  const done = state === "correct";
  return (
    <form onSubmit={submit} data-question={q.id} className="space-y-2 rounded-xs border border-line bg-surface-subtle p-3" aria-describedby={`${uid}-status`}>
      {q.answerType === "choice" && q.options ? (
        <fieldset disabled={done} className="min-w-0">
          <legend className="mb-2 max-w-full font-sans text-[14px] font-semibold text-ink [overflow-wrap:anywhere]">{q.prompt}</legend>
          <div className="space-y-1">
            {q.options.map((o) => (
              <label key={o} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xs px-2 hover:bg-surface sm:min-h-[36px]">
                <input
                  type="radio"
                  name={`${uid}-choice`}
                  value={o}
                  checked={answer === o}
                  onChange={() => setAnswer(o)}
                  className="h-5 w-5 shrink-0 accent-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                />
                <span className="min-w-0 font-sans text-[14px] text-ink [overflow-wrap:anywhere]">{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div>
          <label htmlFor={`${uid}-text`} className="mb-1 block font-sans text-[14px] font-semibold text-ink">
            {q.prompt}
          </label>
          <input
            id={`${uid}-text`}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={done}
            autoComplete="off"
            spellCheck={false}
            className="min-h-[44px] w-full rounded-xs border border-line bg-surface px-3 font-mono text-[14px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={done || state === "checking"}
          className="min-h-[44px] rounded-xs border border-cyan/60 bg-cyan/10 px-4 font-mono text-[13px] font-bold text-cyan transition-colors duration-150 hover:bg-cyan/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "checking" ? "Checking…" : done ? "Solved" : "Check answer"}
        </button>
        {!done && hintsShown < q.hints.length && (
          <button
            type="button"
            onClick={() => setHintsShown((h) => h + 1)}
            className="min-h-[44px] rounded-xs border border-line px-3 font-mono text-[13px] text-muted transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            Show a hint ({hintsShown + 1} of {q.hints.length})
          </button>
        )}
      </div>

      {hintsShown > 0 && (
        <ul className="space-y-1">
          {q.hints.slice(0, hintsShown).map((h, i) => (
            <li key={i} className="rounded-xs border-l-2 border-warning/70 bg-surface px-3 py-1.5 font-sans text-[13px] text-muted">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-warning">Hint {i + 1}: </span>
              {h}
            </li>
          ))}
        </ul>
      )}

      <p id={`${uid}-status`} role="status" aria-live="polite" className={`font-sans text-[13px] ${done ? "text-success" : state === "error" ? "text-danger" : "text-muted"}`}>
        {message && (
          <>
            <span className="font-mono font-bold">{done ? "✓ " : state === "wrong" ? "✗ " : ""}</span>
            {message}
          </>
        )}
      </p>
      {done && explanation && <p className="rounded-xs border border-success/40 bg-success/5 p-3 font-sans text-[14px] leading-relaxed text-ink">{explanation}</p>}
    </form>
  );
}

export function MicroExercise({ exercise, check }: { exercise: PublicExercise; check: Check }) {
  return (
    <section aria-labelledby={`ex-${exercise.id}`} data-exercise={exercise.id} className="not-prose my-8 space-y-4 rounded-sm border border-cyan/40 bg-surface p-4">
      <header>
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan">Try it · {KIND_LABEL[exercise.kind]}</span>
        <h3 id={`ex-${exercise.id}`} className="mt-1 font-sans text-[17px] font-semibold text-ink">
          {exercise.title}
        </h3>
        <p className="mt-1 font-sans text-[14px] leading-relaxed text-muted">{exercise.instructions}</p>
      </header>

      {exercise.blocks.map((b) =>
        b.type === "log" ? (
          <LogBlock key={b.title} title={b.title} lines={b.lines} />
        ) : (
          <figure key={b.title} className="overflow-hidden rounded-sm border border-line">
            <figcaption className="border-b border-line bg-surface-raised px-3 py-1.5 font-mono text-[12px] text-muted">{b.title}</figcaption>
            <div tabIndex={0} role="region" aria-label={`${b.title} (scrolls sideways)`} className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
              <table className="w-full border-collapse text-left font-mono text-[13px]">
                <thead>
                  <tr>
                    {b.columns.map((c) => (
                      <th key={c} scope="col" className="border-b border-line bg-surface-subtle px-3 py-2 font-bold text-muted">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      {r.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-2 text-ink">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </figure>
        ),
      )}

      <div className="space-y-3">
        {exercise.questions.map((q) => (
          <Question key={q.id} exerciseId={exercise.id} q={q} check={check} />
        ))}
      </div>
    </section>
  );
}

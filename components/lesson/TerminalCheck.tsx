"use client";

import { useState } from "react";
import type { PublicQuestion } from "@/lib/content/checks";

export type CheckResult = { correct: boolean; explanations: string[]; lessonCompleted: boolean };

type Props = {
  questions: PublicQuestion[];
  initialPassed: string[];
  answer: (questionId: string, optionIndex: number) => Promise<CheckResult>;
};

function Question({
  q,
  passed,
  answer,
  onResult,
}: {
  q: PublicQuestion;
  passed: boolean;
  answer: Props["answer"];
  onResult: (r: CheckResult) => void;
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

  return (
    <fieldset
      className="border border-line p-4"
      data-attempts={attempts}
      data-result={pending ? "pending" : result ? (result.correct ? "correct" : "wrong") : "idle"}
    >
      <legend className="px-2 text-ink">{q.prompt}</legend>
      {passed && <p className="mb-2 font-ui text-sm text-cyan">Passed</p>}
      <ul className="space-y-2">
        {q.options.map((text, i) => (
          <li key={i}>
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name={q.id}
                className="mt-1.5 accent-cyan"
                checked={choice === i}
                onChange={() => setChoice(i)}
              />
              <span>{text}</span>
            </label>
            {result && (
              <p className={`ml-7 mt-1 text-sm ${i === choice ? "text-ink" : "text-muted"}`}>{result.explanations[i]}</p>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={check}
          disabled={choice === null || pending}
          className="border border-cyan px-4 py-1 text-cyan hover:bg-cyan hover:text-void disabled:opacity-40"
        >
          Check answer
        </button>
        {result && (
          <span className={`font-ui ${result.correct ? "text-cyan" : "text-pink"}`}>{result.correct ? "Correct" : "Not quite"}</span>
        )}
        {error && (
          <span role="alert" className="text-sm text-pink">
            {error}
          </span>
        )}
      </div>
    </fieldset>
  );
}

/** Terminal Check: answers are graded on the server; the browser never has the answer key. */
export function TerminalCheck({ questions, initialPassed, answer }: Props) {
  const [passed, setPassed] = useState(() => new Set(initialPassed));
  const [completed, setCompleted] = useState(false);

  return (
    <div className="not-prose space-y-4">
      {questions.map((q) => (
        <Question
          key={q.id}
          q={q}
          passed={passed.has(q.id)}
          answer={answer}
          onResult={(r) => {
            if (r.correct) setPassed((s) => new Set(s).add(q.id));
            if (r.lessonCompleted) setCompleted(true);
          }}
        />
      ))}
      <p role="status" className="font-ui text-purple">
        {completed ? "Lesson complete! XP added to your profile." : ""}
      </p>
    </div>
  );
}

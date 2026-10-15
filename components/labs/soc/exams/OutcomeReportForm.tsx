"use client";

import { useState } from "react";
import { submitSocExamOutcomeAction } from "@/app/(app)/labs/soc/exams/actions";

const FAMILIES: Array<[string, string]> = [
  ["practical-soc-analyst", "A hands-on SOC analyst exam"],
  ["soc-analyst-knowledge", "A multiple-choice SOC analyst exam"],
  ["security-fundamentals", "A security fundamentals exam"],
  ["other", "Something else"],
];

/** Optional, consented outcome self-report. Private to the platform owner; never changes scores. */
export function OutcomeReportForm({ already }: { already: number }) {
  const [family, setFamily] = useState("practical-soc-analyst");
  const [date, setDate] = useState("");
  const [passed, setPassed] = useState<"yes" | "no" | "">("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    try {
      await submitSocExamOutcomeAction({ certFamily: family, examDate: date, passed: passed === "yes", consent });
      setState("saved");
      setMessage("Thank you. Your report is stored privately and is only used to check our readiness estimate.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error && !err.message.startsWith("[") ? err.message : "Please complete every field and tick the consent box.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 font-sans text-sm" aria-describedby="outcome-why">
      <p id="outcome-why" className="max-w-prose text-secondary">
        Optional. If you took a real exam, telling us how it went helps us check whether this provisional estimate is any good. Only the platform owner can see it; it never changes your scores here.{already ? ` You have shared ${already} result${already === 1 ? "" : "s"}.` : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="block text-secondary">Kind of exam</span>
          <select value={family} onChange={(e) => setFamily(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xs border border-line bg-void px-2 text-ink">
            {FAMILIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-secondary">Date taken</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xs border border-line bg-void px-2 text-ink" />
        </label>
        <fieldset>
          <legend className="text-secondary">Result</legend>
          <div className="mt-1 flex gap-4">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex min-h-[44px] items-center gap-2 text-ink">
                <input type="radio" name="passed" value={v} required checked={passed === v} onChange={() => setPassed(v)} className="accent-cyan" />
                {v === "yes" ? "Passed" : "Did not pass"}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="flex items-start gap-3 text-ink">
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-cyan" />
        <span>I agree that the platform owner may store this result with my account and use it, without my name, to check the readiness estimate. I can delete it by deleting my account data.</span>
      </label>
      <button type="submit" disabled={state === "saving" || state === "saved"} className="min-h-[44px] rounded-xs border border-line bg-surface-raised px-4 font-ui text-ink hover:bg-surface-hover disabled:opacity-50">
        {state === "saving" ? "Saving…" : state === "saved" ? "Shared" : "Share my result"}
      </button>
      <p role="status" className="text-secondary">{message}</p>
    </form>
  );
}

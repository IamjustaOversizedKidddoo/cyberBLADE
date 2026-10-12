"use client";

import { useState } from "react";
import { submitExamReportAction } from "@/app/(app)/exam/actions";
import type { ExamReportRecord } from "@/lib/progress/types";
import { IconCheck } from "@/components/ui/icons";

type Props = {
  reports: ExamReportRecord[];
};

export function ExamReportDialog({ reports }: Props) {
  const [open, setOpen] = useState(false);
  const [examType, setExamType] = useState("CompTIA Security+");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("900");
  const [passed, setPassed] = useState(true);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    setPending(true);
    setStatusMessage(null);

    try {
      await submitExamReportAction({
        examType,
        score: Number(score),
        maxScore: Number(maxScore),
        passed,
        notes: notes.trim() || undefined,
      });

      setStatusMessage("Exam report recorded successfully!");
      setScore("");
      setNotes("");
      setOpen(false);
    } catch {
      setStatusMessage("Failed to submit report. Please check the values entered.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="exam-report-heading" className="rounded-xs border border-line bg-console p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-4">
        <div>
          <h3 id="exam-report-heading" className="font-ui text-sm font-bold text-ink uppercase tracking-wider">
            REAL-WORLD CERTIFICATION LOG
          </h3>
          <p className="font-sans text-xs text-secondary mt-0.5">
            Voluntary, private self-reports to track your external examination results and platform alignment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-xs border border-cyan bg-cyan/10 px-4 py-1.5 font-ui text-xs font-bold tracking-wider text-cyan hover:bg-cyan hover:text-void transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          {open ? "CANCEL" : "+ LOG EXAM RESULT"}
        </button>
      </div>

      {statusMessage && (
        <p role="status" className="font-ui text-xs text-cyan">
          {statusMessage}
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xs border border-line/80 bg-surface p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="examType" className="font-ui text-xs text-muted block mb-1">
                Exam Blueprint
              </label>
              <select
                id="examType"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full rounded-xs border border-line bg-surface-subtle px-3 py-1.5 font-ui text-xs text-ink focus:border-cyan focus:outline-none"
              >
                <option value="CompTIA Security+ (SY0-701)">CompTIA Security+ (SY0-701)</option>
                <option value="CompTIA Network+ (N10-009)">CompTIA Network+ (N10-009)</option>
                <option value="CompTIA A+ Security (220-1102)">CompTIA A+ (220-1102)</option>
                <option value="ISC2 CC (Certified in Cybersecurity)">ISC2 CC</option>
                <option value="Custom / Other Industry Credential">Other Credential</option>
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="score" className="font-ui text-xs text-muted block mb-1">
                  Your Score
                </label>
                <input
                  id="score"
                  type="number"
                  required
                  placeholder="e.g. 780"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full rounded-xs border border-line bg-surface-subtle px-3 py-1.5 font-mono text-xs text-ink focus:border-cyan focus:outline-none"
                />
              </div>

              <div className="flex-1">
                <label htmlFor="maxScore" className="font-ui text-xs text-muted block mb-1">
                  Max Score
                </label>
                <input
                  id="maxScore"
                  type="number"
                  required
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  className="w-full rounded-xs border border-line bg-surface-subtle px-3 py-1.5 font-mono text-xs text-ink focus:border-cyan focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-ui text-xs text-ink flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={passed}
                onChange={(e) => setPassed(e.target.checked)}
                className="rounded-xs text-cyan focus:ring-cyan"
              />
              <span>Examination Passed</span>
            </label>
          </div>

          <div>
            <label htmlFor="notes" className="font-ui text-xs text-muted block mb-1">
              Field Notes / Reflection (Optional)
            </label>
            <input
              id="notes"
              type="text"
              placeholder="e.g. PBQs matched our lab scenarios closely"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xs border border-line bg-surface-subtle px-3 py-1.5 font-sans text-xs text-ink focus:border-cyan focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-xs bg-cyan px-5 py-2 font-ui text-xs font-bold tracking-wider text-void hover:bg-cyan/90 transition-colors disabled:opacity-50"
          >
            {pending ? "RECORDING..." : "SAVE VERIFICATION RECORD"}
          </button>
        </form>
      )}

      {/* Render Existing Reports */}
      {reports.length > 0 && (
        <ul className="space-y-2.5 pt-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-xs border border-line bg-surface p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-ui font-bold uppercase tracking-wider ${r.passed ? "text-emerald-400" : "text-amber-400"}`}>
                    {r.passed ? "PASS" : "ATTEMPT"}
                  </span>
                  <span className="font-ui font-semibold text-ink">{r.examType}</span>
                </div>
                {r.notes && <p className="font-sans text-muted mt-1 text-[11px]">{r.notes}</p>}
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-cyan">
                  {r.score} / {r.maxScore} ({Math.round((r.score / r.maxScore) * 100)}%)
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {new Date(r.reportedAt).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

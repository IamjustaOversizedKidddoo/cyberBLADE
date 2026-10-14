import type { AiResultView } from "@/lib/lab-engine/soc/ai-grading/compose";
import { AiStatusChip } from "./AiStatusChip";

const MODE_TEXT: Record<AiResultView["mode"], string> = {
  off: "AI writing feedback is switched off. Your score comes only from the automatic checks.",
  shadow: "AI writing feedback is being tested behind the scenes and is not shown or counted.",
  preview: "AI writing feedback is shown as a preview. It does not change your score.",
  live: "AI writing feedback is live. Graded writing criteria count toward your total, capped at a small share.",
};

/** Plain-language transparency panel. Native <details> keeps it keyboard and screen-reader friendly. */
export function HowAiFeedbackWorks({ view }: { view: AiResultView }) {
  return (
    <details className="group rounded-xs border border-line bg-surface-subtle">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan [&::-webkit-details-marker]:hidden">
        How AI feedback works
        <span aria-hidden="true" className="text-muted transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none">
          ›
        </span>
      </summary>
      <div className="space-y-3 border-t border-line px-3 py-3 font-sans text-[13px] leading-relaxed text-muted">
        <p>{MODE_TEXT[view.mode]}</p>
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">What is checked automatically</h4>
          <p>Verdict, scope, indicators, timeline, evidence links, technique mapping, response actions, escalation and hygiene. These checks are exact and decide most of your score.</p>
        </div>
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">What the AI looks at</h4>
          <p>Only how you wrote: narrative, reasoning, consistency, recommendations, handoff and tone. It sees your report text, the template guidance and the scenario briefing you were shown.</p>
        </div>
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">What the AI never sees</h4>
          <p>The answer key, the model report, your automatic scores, your account details, email address or handle. Personal details are removed before anything is sent.</p>
        </div>
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">Safeguards</h4>
          <p>Every quote the AI uses must appear word-for-word in your report. Unclear or unverifiable answers are not graded rather than guessed. Some results are checked by a person, and you can ask for a human review.</p>
        </div>
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">Calibration</h4>
          <p>
            {view.calibrated
              ? "This AI setup passed a calibration check against human graders before it was allowed to count."
              : "Not yet calibrated against human graders. Treat this feedback as a learning aid, not a verdict."}
          </p>
        </div>
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">Current status</h4>
          <ul className="mt-1 space-y-1">
            {view.criteria.map((c) => (
              <li key={c.criterionId} className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.title}</span>
                <span className="flex items-center gap-2">
                  <AiStatusChip status={c.displayStatus} />
                  <span className="text-[11px] text-muted">{c.countsInTotal ? "counts" : "does not count"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

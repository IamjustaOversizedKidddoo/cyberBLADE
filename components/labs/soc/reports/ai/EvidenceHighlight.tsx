import { reportFieldText } from "@/lib/lab-engine/soc/ai-grading/boundary";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";
import type { AiReportField, VerifiedSpan } from "@/lib/lab-engine/soc/ai-grading/types";

const FIELD_NAMES: Record<AiReportField, string> = {
  executiveSummary: "Executive summary",
  attackNarrative: "Attack narrative",
  verdictJustification: "Verdict justification",
  timelineDescriptions: "Timeline",
  iocNotes: "Indicator notes",
  lessonsLearned: "Lessons learned",
  actions: "Recommended actions",
  escalationTeam: "Escalation",
  escalationUrgency: "Escalation",
  handoffSummary: "Handoff summary",
};

/**
 * Shows the learner's OWN section text with the verified quotes marked. Quotes were checked
 * server-side to be verbatim; if sanitization changed the text (e.g. a removed email) and a
 * quote no longer matches, it is shown on its own instead.
 */
export function EvidenceHighlight({ report, spans }: { report: SocReportData; spans: VerifiedSpan[] }) {
  const byField = new Map<AiReportField, VerifiedSpan[]>();
  for (const s of spans) byField.set(s.field, [...(byField.get(s.field) ?? []), s]);

  return (
    <div className="space-y-2">
      {[...byField.entries()].map(([field, list]) => {
        const text = reportFieldText(report, field);
        const ranges = list
          .map((s) => ({ s, at: text.indexOf(s.text) }))
          .filter((r) => r.at >= 0)
          .sort((a, b) => a.at - b.at);
        const unmatched = list.filter((s) => text.indexOf(s.text) < 0);
        const parts: Array<{ t: string; mark: boolean }> = [];
        let cursor = 0;
        for (const { s, at } of ranges) {
          if (at < cursor) continue;
          parts.push({ t: text.slice(cursor, at), mark: false }, { t: s.text, mark: true });
          cursor = at + s.text.length;
        }
        parts.push({ t: text.slice(cursor), mark: false });
        return (
          <figure key={field} className="rounded-xs border border-line bg-surface-subtle p-2.5">
            <figcaption className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              From your {FIELD_NAMES[field].toLowerCase()}
            </figcaption>
            {ranges.length > 0 && (
              <p className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-muted">
                {parts.map((p, i) =>
                  p.mark ? (
                    <mark key={i} className="rounded-xs bg-cyan/15 px-0.5 text-ink underline decoration-cyan decoration-2 underline-offset-2">
                      {p.t}
                    </mark>
                  ) : (
                    <span key={i}>{p.t}</span>
                  ),
                )}
              </p>
            )}
            {unmatched.map((s, i) => (
              <blockquote key={i} className="mt-1 border-l-2 border-cyan pl-2 font-sans text-[13px] text-ink">
                “{s.text}”
              </blockquote>
            ))}
          </figure>
        );
      })}
    </div>
  );
}

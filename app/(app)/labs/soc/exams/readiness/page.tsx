import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroBand } from "@/components/theme/HeroBand";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { isSocExamsEnabled } from "@/lib/config/env";
import { getExamInsights } from "@/lib/lab-engine/soc/exam/insights";
import { loadExamConfig } from "@/lib/lab-engine/soc/exam/config";
import { OutcomeReportForm } from "@/components/labs/soc/exams/OutcomeReportForm";
import { IconCheck, IconCircle, IconInfo } from "@/components/ui/icons";

export const metadata: Metadata = { title: "SOC Readiness · CyberBLADE" };

const STATE_TEXT = { not_ready: "Not ready yet", close: "Close", ready: "Ready (provisional)" } as const;
const panel = "rounded-xs border border-line bg-surface p-5";

export default async function SocReadinessPage() {
  if (!isSocExamsEnabled()) notFound();
  const operator = await requireOperator();
  const v = await getExamInsights(getCtx(), operator.id);
  const titles = loadExamConfig().formats;
  const r = v.readiness;

  return (
    <main>
      <HeroBand title="readiness_check" kicker="> PROVISIONAL · BASED ON YOUR RECENT PRACTICE EXAMS" />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 font-sans text-sm sm:px-6">
        <section className={panel} aria-labelledby="state">
          <p className="font-ui text-xs uppercase tracking-widest text-muted">Provisional readiness check</p>
          <h2 id="state" className="mt-1 flex items-center gap-2 font-ui text-xl text-ink">
            {r.state === "ready" ? <IconCheck className="h-5 w-5 text-success" aria-hidden="true" /> : <IconCircle className="h-4 w-4 text-cyan" aria-hidden="true" />}
            {STATE_TEXT[r.state]}
          </h2>
          {r.statement && <p className="mt-3 max-w-prose text-base text-ink">{r.statement}</p>}
          <p className="mt-3 max-w-prose text-secondary">
            This check uses your {r.examIds.length ? `${r.examIds.length} most recent counted` : "recent"} practice exams. Its thresholds are provisional and have not yet been checked against real exam results. Practice exams are unproctored and are not equivalent to any real exam.
          </p>
          <ul className="mt-4 space-y-2">
            {r.criteria.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                {c.met ? <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />}
                <span><strong className="font-semibold text-ink">{c.met ? "Met" : "Not met yet"}:</strong> <span className="text-ink">{c.label}.</span> <span className="text-secondary">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <section className={panel} aria-labelledby="plan">
          <h2 id="plan" className="font-ui text-base text-ink">Study plan</h2>
          {v.studyPlan.entries.length === 0 ? (
            <p className="mt-2 text-secondary">{v.studyPlan.basedOnExams ? "No skill is below the provisional floor in your recent exams. Keep practising across formats." : "Take a practice exam to get a study plan."}</p>
          ) : (
            <ol className="mt-3 space-y-5">
              {v.studyPlan.entries.map((e) => (
                <li key={e.skill} className="border-t border-line/60 pt-4 first:border-0 first:pt-0">
                  <h3 className="font-ui text-ink">{e.title} <span className="font-mono text-secondary">· {e.percent}%</span></h3>
                  {e.lessons.length > 0 && (
                    <p className="mt-1 text-secondary">Revisit: {e.lessons.map((l, i) => <span key={l.id}>{i > 0 && ", "}<Link href={l.href} className="text-cyan underline underline-offset-4 hover:text-ink">{l.title}</Link></span>)}</p>
                  )}
                  {e.reviewDue > 0 && <p className="mt-1 text-secondary"><Link href={v.studyPlan.reviewHref} className="text-cyan underline underline-offset-4 hover:text-ink">{e.reviewDue} review card{e.reviewDue === 1 ? "" : "s"} due</Link> for these lessons.</p>}
                  {e.practice.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-secondary">
                      {e.practice.map((p) => <li key={p.target}><Link href={p.href} className="text-cyan underline underline-offset-4 hover:text-ink">{p.title}</Link> — {p.instruction}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {v.studyPlan.miniQueueHref && <p className="mt-4 text-secondary">Short on time? Try a <Link href={v.studyPlan.miniQueueHref} className="text-cyan underline underline-offset-4 hover:text-ink">10-minute time-management drill</Link> (practice only).</p>}
        </section>

        <section className={panel} aria-labelledby="trend">
          <h2 id="trend" className="font-ui text-base text-ink">Trend</h2>
          {Object.keys(v.trend).length === 0 ? (
            <p className="mt-2 text-secondary">No submitted exams yet.</p>
          ) : (
            Object.entries(v.trend).map(([format, rows]) => (
              <div key={format} className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left">
                  <caption className="text-left font-ui text-ink">{titles[format as keyof typeof titles]?.title ?? format}</caption>
                  <thead className="font-ui text-xs text-muted"><tr><th scope="col" className="py-1">Date (UTC)</th><th scope="col">Score</th><th scope="col">Change</th></tr></thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.examId} className="border-t border-line/60">
                        <td className="py-1.5 text-secondary">{row.submittedAt.slice(0, 10)}</td>
                        <td className="font-mono text-ink">{row.scorePercent}%</td>
                        <td className="font-mono text-secondary">{i === 0 ? "—" : `${row.scorePercent - rows[i - 1].scorePercent >= 0 ? "+" : ""}${row.scorePercent - rows[i - 1].scorePercent}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </section>

        <section className={panel} aria-labelledby="outcome">
          <h2 id="outcome" className="font-ui text-base text-ink">Took a real exam? (optional)</h2>
          <div className="mt-3"><OutcomeReportForm already={v.outcomeReportsCount} /></div>
        </section>

        <p><Link href="/labs/soc/exams" className="font-ui text-cyan underline underline-offset-4 hover:text-ink">Back to practice exams</Link></p>
      </div>
    </main>
  );
}

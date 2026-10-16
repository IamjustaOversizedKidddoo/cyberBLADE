import Link from "next/link";
import type { ExamStateView } from "@/lib/lab-engine/soc/exam/service";
import { IconCheck, IconCross, IconInfo } from "@/components/ui/icons";
import { BUDGET_NAMES, FLAG_NAMES, minutesText } from "./format";

const panel = "rounded-xs border border-line bg-surface p-4 sm:p-5";
const h2 = "font-ui text-sm uppercase tracking-wider text-cyan";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/50 py-2 last:border-0">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-mono text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/** Post-submission results for the learner's own exam (rendered on the server). */
export function ExamResultView({ state, skillTitles }: { state: ExamStateView; skillTitles: Record<string, string> }) {
  const r = state.result;
  if (!r) return null;
  const items = state.knowledgeItems ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 font-sans text-sm">
      <header className="space-y-2">
        <p className="font-ui text-xs uppercase tracking-widest text-muted">Practice exam result · unproctored · provisional scoring</p>
        <h1 className="font-display text-3xl text-ink">{state.title}</h1>
        <p className="text-base text-secondary">
          Score <strong className="font-mono text-2xl text-ink">{r.scorePercent}%</strong>
          <span className="ml-3">{r.submitReason === "deadline" ? "Submitted automatically when time ran out." : "Submitted by you."}</span>
        </p>
        <p className="text-muted">This practice score is an estimate of your skills on our simulator. It is not equivalent to, and does not predict, any real exam result.</p>
      </header>

      <section className={panel} aria-labelledby="h-components">
        <h2 id="h-components" className={h2}>What made up your score</h2>
        <table className="mt-3 w-full text-left">
          <caption className="sr-only">Score components</caption>
          <thead className="font-ui text-xs text-muted">
            <tr><th scope="col" className="py-1">Part</th><th scope="col">Weight</th><th scope="col">Result</th></tr>
          </thead>
          <tbody>
            {r.components.map((c) => (
              <tr key={c.id} className="border-t border-line/50 align-top">
                <th scope="row" className="py-2 pr-2 font-normal text-ink">
                  {c.label}
                  {c.note && <span className="mt-1 block text-xs text-muted">{c.note}</span>}
                </th>
                <td className="py-2 font-mono">{Math.round(c.weight * 100)}%</td>
                <td className="py-2 font-mono">{c.graded ? `${c.percent}%` : "Not graded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={panel} aria-labelledby="h-skills">
        <h2 id="h-skills" className={h2}>Skills</h2>
        <ul className="mt-3 space-y-3">
          {r.perSkill.map((s) => (
            <li key={s.skill}>
              <div className="flex justify-between gap-3"><span className="text-ink">{skillTitles[s.skill] ?? s.skill}</span><span className="font-mono text-ink">{s.percent}%</span></div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-surface-raised" aria-hidden="true"><div className="h-1.5 rounded-full bg-cyan" style={{ width: `${s.percent}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {r.decisionQuality && (
          <section className={panel} aria-labelledby="h-decisions">
            <h2 id="h-decisions" className={h2}>Decision quality</h2>
            <dl className="mt-2">
              <Row label="Alerts triaged" value={`${r.decisionQuality.alertsDecided} / ${r.decisionQuality.alertsTotal}`} />
              <Row label="Correct dispositions" value={r.decisionQuality.correctDispositions} />
              <Row label="Over-escalations" value={r.decisionQuality.overEscalations} />
              <Row label="Under-escalations" value={r.decisionQuality.underEscalations} />
              <Row label="False positives handled" value={`${r.decisionQuality.falsePositivesHandled} / ${r.decisionQuality.falsePositivesTotal}`} />
            </dl>
          </section>
        )}
        <section className={panel} aria-labelledby="h-time">
          <h2 id="h-time" className={h2}>Time</h2>
          <dl className="mt-2">
            <Row label="Time used" value={`${minutesText(r.timeAnalysis.durationSeconds)} of ${minutesText(r.timeAnalysis.budgetSeconds)}`} />
            <Row label="Within time" value={r.timeAnalysis.withinBudget ? "Yes" : "No"} />
            {r.decisionQuality && <Row label="Typical time per alert" value={minutesText(r.timeAnalysis.medianSecondsPerAlert)} />}
            <Row label="Longest gap without activity" value={minutesText(r.timeAnalysis.longestIdleGapSeconds)} />
            {r.decisionQuality && <Row label="First escalation after" value={minutesText(r.timeAnalysis.timeToFirstContainmentSeconds)} />}
          </dl>
        </section>
        {r.thoroughness && (
          <section className={panel} aria-labelledby="h-thorough">
            <h2 id="h-thorough" className={h2}>Thoroughness</h2>
            <dl className="mt-2">
              <Row label="Log searches" value={r.thoroughness.queries} />
              <Row label="Enrichment lookups" value={`${r.thoroughness.lookups} (${r.thoroughness.distinctEntitiesLookedUp} distinct)`} />
              <Row label="Questions answered" value={`${r.thoroughness.questionsAnswered} / ${r.thoroughness.questionsTotal}`} />
              {Object.entries(r.budgetsUsed).map(([k, b]) => <Row key={k} label={`${BUDGET_NAMES[k] ?? k} used`} value={`${b.used} / ${b.limit}`} />)}
            </dl>
          </section>
        )}
        {r.report && (
          <section className={panel} aria-labelledby="h-report">
            <h2 id="h-report" className={h2}>Incident report · {r.report.totalPercent}% of graded criteria</h2>
            <ul className="mt-2 space-y-1">
              {r.report.criteria.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 border-b border-line/50 py-1.5 last:border-0">
                  <span className="capitalize text-ink">{c.label}</span>
                  <span className="font-mono">{c.status === "graded" ? `${c.percent}%` : "Not graded"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {r.ruleChallenge && (
          <section className={panel} aria-labelledby="h-rule-challenge">
            <h2 id="h-rule-challenge" className={h2}>Detection Rule Evaluation · {r.ruleChallenge.scorePercent}%</h2>
            <div className="mt-2 space-y-3">
              <p className="flex items-center gap-2 text-ink">
                {r.ruleChallenge.passed ? <IconCheck className="h-5 w-5 text-success" aria-hidden="true" /> : <IconCross className="h-5 w-5 text-danger" aria-hidden="true" />}
                <strong>{r.ruleChallenge.passed ? "Passed Challenge Criteria" : "Did Not Meet Challenge Thresholds"}</strong>
              </p>
              <dl className="mt-2">
                <Row label="Hold-out incident recall" value={`${r.ruleChallenge.holdOutDetected} / ${r.ruleChallenge.holdOutTotal} (${r.ruleChallenge.recallPercent}%)`} />
                <Row label="Benign decoy trigger rate (FPR)" value={`${r.ruleChallenge.benignTriggered} / ${r.ruleChallenge.benignTotal} (${r.ruleChallenge.falsePositiveRatePercent}%)`} />
                <Row label="Precision" value={`${r.ruleChallenge.precisionPercent}%`} />
              </dl>
              {r.ruleChallenge.feedback.length > 0 && (
                <div className="mt-3 space-y-1 rounded-xs border border-line/60 bg-void/50 p-3">
                  <p className="font-ui text-xs uppercase tracking-wider text-muted">Rule Quality & Diagnostics</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-secondary">
                    {r.ruleChallenge.feedback.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <section className={panel} aria-labelledby="h-flags">
        <h2 id="h-flags" className={h2}>Integrity notes</h2>
        <p className="mt-1 text-muted">Informational only. They never change your score, but the provisional readiness check looks for exams without them.</p>
        {r.integrityFlags.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-ink"><IconCheck className="h-4 w-4 text-success" aria-hidden="true" /> None.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {r.integrityFlags.map((f) => (
              <li key={f.code} className="flex items-start gap-2 text-ink"><IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" /><span><strong className="font-semibold">{FLAG_NAMES[f.code] ?? f.code}:</strong> {f.detail}</span></li>
            ))}
          </ul>
        )}
      </section>

      {state.knowledgeReview && (
        <section className={panel} aria-labelledby="h-review">
          <h2 id="h-review" className={h2}>Review · {r.knowledge?.correct} of {r.knowledge?.total} correct</h2>
          <ol className="mt-3 space-y-5">
            {items.map((item, n) => {
              const rev = state.knowledgeReview![item.id];
              const text = (ids: string[]) => ids.map((id) => item.options.find((o) => o.id === id)?.text ?? "—").join(item.type === "ordering" ? " → " : "; ");
              return (
                <li key={item.id} className="border-t border-line/50 pt-4 first:border-0 first:pt-0">
                  <p className="text-ink"><span className="mr-2 font-mono text-cyan">Q{n + 1}.</span>{item.stem}</p>
                  <p className="mt-2 flex items-center gap-2 text-ink">
                    {rev.correct ? <IconCheck className="h-4 w-4 text-success" aria-hidden="true" /> : <IconCross className="h-4 w-4 text-danger" aria-hidden="true" />}
                    <strong>{rev.correct ? "Correct" : "Not correct"}</strong>
                  </p>
                  <p className="mt-1 text-secondary">Your answer: {item.savedAnswer?.length ? text(item.savedAnswer) : "not answered"}</p>
                  {!rev.correct && <p className="text-secondary">Correct answer: {text(rev.correctOptionIds)}</p>}
                  <p className="mt-1 max-w-prose text-muted">{rev.explanation}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <nav className="flex flex-wrap gap-3 font-ui text-sm" aria-label="Next steps">
        {state.socAttemptId && <Link href={`/labs/soc/exams/${state.examId}?review=1`} className="inline-flex min-h-[44px] items-center rounded-xs border border-cyan bg-cyan/15 px-4 text-cyan hover:bg-cyan/25">Review alerts, debriefs{r.report ? " and model report" : ""}</Link>}
        <Link href="/labs/soc/exams/readiness" className="inline-flex min-h-[44px] items-center rounded-xs border border-line px-4 text-ink hover:bg-surface-hover">Readiness and study plan</Link>
        <Link href="/labs/soc/exams" className="inline-flex min-h-[44px] items-center rounded-xs border border-line px-4 text-ink hover:bg-surface-hover">All practice exams</Link>
      </nav>
    </div>
  );
}

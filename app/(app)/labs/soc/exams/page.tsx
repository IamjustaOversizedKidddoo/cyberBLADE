import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroBand } from "@/components/theme/HeroBand";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { isSocExamsEnabled } from "@/lib/config/env";
import { getExamLobby } from "@/lib/lab-engine/soc/exam/service";
import { StartExamButton } from "@/components/labs/soc/exams/StartExamButton";
import { BUDGET_NAMES } from "@/components/labs/soc/exams/format";
import { COMPONENT_LABEL } from "@/lib/lab-engine/soc/exam/results";

export const metadata: Metadata = { title: "SOC Practice Exams · CyberBLADE" };

const RULES = [
  "Practice exams are unproctored and are not equivalent to any real certification exam. Formats are provisional, built in the spirit of practical SOC assessments.",
  "The clock runs on our server. Refreshing, opening another tab or changing your device clock does not add time. When time runs out, the exam submits itself with everything you saved.",
  "Each start is one attempt. You can't pause or restart it.",
  "Nothing is marked during the exam: no right/wrong, no hints, no debriefs and no Handler. All of that appears after you submit, and only for you.",
  "Searches, lookups and question answers are limited per exam. Every use counts.",
  "After an attempt there's a short cooldown, and each format has a limit per period.",
  "Integrity notes (such as very fast decisions) are informational and never change your score.",
];

export default async function SocExamLobbyPage() {
  if (!isSocExamsEnabled()) notFound();
  const operator = await requireOperator();
  const lobby = await getExamLobby(getCtx(), operator.id);

  return (
    <main>
      <HeroBand title="practice_exams" kicker="> SOC L1 · TIMED · PROVISIONAL">
        Timed practice under exam-like rules, with a full breakdown afterwards. Calm pace, your own work, no tricks.
      </HeroBand>

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 font-sans text-sm sm:px-6">
        {lobby.activeExamId && (
          <p className="flex flex-wrap items-center gap-3 rounded-xs border border-cyan/40 bg-cyan/10 p-4 text-ink" role="status">
            <span>You have an exam in progress.</span>
            <Link href={`/labs/soc/exams/${lobby.activeExamId}`} className="inline-flex min-h-[44px] items-center rounded-xs border border-cyan px-4 font-ui text-cyan hover:bg-cyan/20">Resume exam</Link>
          </p>
        )}

        <section aria-labelledby="rules" className="rounded-xs border border-line bg-surface p-5">
          <h2 id="rules" className="font-ui text-base text-ink">How practice exams work</h2>
          <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-secondary">
            {RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {lobby.timeMultiplier !== 1 && <p className="mt-3 text-ink">Your account has extended time: every exam lasts ×{lobby.timeMultiplier} as long. The times below include it.</p>}
        </section>

        <section aria-labelledby="formats">
          <h2 id="formats" className="font-ui text-base text-ink">Formats</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {lobby.formats.map((f) => (
              <li key={f.format} id={f.format} className="flex flex-col gap-3 rounded-xs border border-line bg-surface p-5">
                <div>
                  <h3 className="font-ui text-base text-ink">{f.title}</h3>
                  <p className="mt-1 text-secondary">{f.summary}</p>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-secondary">
                  <dt>Time</dt><dd className="text-ink">{f.durationMinutes} minutes</dd>
                  <dt>Scored on</dt>
                  <dd className="text-ink">{Object.entries(f.weights).map(([k, w]) => `${COMPONENT_LABEL[k] ?? k} ${Math.round(w * 100)}%`).join(", ")}</dd>
                  {f.itemCount && (<><dt>Questions</dt><dd className="text-ink">{f.itemCount}</dd></>)}
                  {Object.keys(f.budgets).length > 0 && (<><dt>Limits</dt><dd className="text-ink">{Object.entries(f.budgets).map(([k, v]) => `${BUDGET_NAMES[k] ?? k} ${v}`).join(", ")}</dd></>)}
                  <dt>Attempts</dt><dd className="text-ink">{f.maxAttempts.count} per {f.maxAttempts.windowDays === 1 ? "day" : `${f.maxAttempts.windowDays} days`}{f.cooldownMinutes ? `, ${f.cooldownMinutes} min cooldown` : ""}</dd>
                  <dt>Readiness</dt><dd className="text-ink">{f.countsForReadiness ? "Counts towards the readiness check" : "Practice only, not counted"}</dd>
                </dl>
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <StartExamButton format={f.format} title={f.title} minutes={f.durationMinutes} disabled={!f.available} />
                  {f.unavailableReason && <span className="text-muted">{f.unavailableReason}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="history">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="history" className="font-ui text-base text-ink">Your attempts</h2>
            <Link href="/labs/soc/exams/readiness" className="font-ui text-cyan underline underline-offset-4 hover:text-ink">Readiness and study plan</Link>
          </div>
          {lobby.history.length === 0 ? (
            <p className="mt-3 text-muted">No attempts yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left">
                <caption className="sr-only">Your exam attempts, newest first</caption>
                <thead className="font-ui text-xs text-muted"><tr><th scope="col" className="py-2">Exam</th><th scope="col">Started</th><th scope="col">Status</th><th scope="col">Score</th></tr></thead>
                <tbody>
                  {lobby.history.map((h) => (
                    <tr key={h.examId} className="border-t border-line/60">
                      <th scope="row" className="py-2 font-normal"><Link href={`/labs/soc/exams/${h.examId}`} className="text-cyan underline underline-offset-4 hover:text-ink">{h.title}</Link></th>
                      <td className="text-secondary">{new Date(h.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</td>
                      <td className="text-secondary">{h.status === "active" ? "In progress" : h.submitReason === "deadline" ? "Time ran out" : "Submitted"}</td>
                      <td className="font-mono text-ink">{h.scorePercent === null ? "—" : `${h.scorePercent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

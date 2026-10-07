import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChallengeTimer } from "@/components/challenge/ChallengeTimer";
import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { proseComponents } from "@/components/lesson/prose";
import { HeroBand } from "@/components/theme/HeroBand";
import { TerminalPanel } from "@/components/theme/TerminalPanel";
import { renderMdx } from "@/lib/content/mdx";
import { requireOperator } from "@/lib/identity/session";
import { findChallengeLab, getChallengeSession, getRankSummary } from "@/lib/progress/challenge";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";
import { abandonChallengeAction, startChallengeAction, submitChallengeObjectiveAction } from "../actions";

export const metadata: Metadata = { title: "Rank challenge" };

const button = "border border-cyan px-6 py-2 font-ui text-lg text-cyan hover:bg-cyan hover:text-void";

export default async function ChallengePage(props: PageProps<"/challenge/[rank]">) {
  const { rank: raw } = await props.params;
  if (!/^[0-2]$/.test(raw)) notFound();
  const rank = Number(raw);

  const operator = await requireOperator();
  const ctx = getCtx();
  let lab;
  try {
    lab = await findChallengeLab(ctx, rank);
  } catch {
    notFound();
  }
  const summary = await getRankSummary(ctx, operator.id, rank);
  const state = summary.challenge;
  const next = rankName(rank + 1);

  if (state.kind === "passed") {
    return (
      <main>
        <HeroBand title={`rank_${rank + 1}_unlocked`} kicker="> challenge passed">
          <p>
            Rank {rank + 1} · {next} unlocked. You proved you can work the machine on your own.
          </p>
        </HeroBand>
        <div className="mx-auto max-w-3xl px-4 py-12">
          <Link href="/dashboard" className={button}>
            Back to the dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state.kind === "active") {
    const session = await getChallengeSession(ctx, operator.id, rank);
    if (!session) notFound();
    const briefing = await renderMdx(session.briefingText, proseComponents, "md");
    return (
      <main>
        <HeroBand title={session.labTitle} kicker={`> rank_${rank} challenge · live`}>
          <ChallengeTimer expiresAt={session.expiresAt} />
        </HeroBand>
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
          <section className="max-w-[72ch]">{briefing}</section>
          <LabWorkspace
            world={session.world}
            objectives={session.objectives}
            onSubmit={submitChallengeObjectiveAction.bind(null, session.attemptId)}
            doneMessage={`Rank ${rank + 1} · ${next} unlocked`}
          />
          <form action={abandonChallengeAction.bind(null, session.attemptId, rank)}>
            <button type="submit" className="neon-toggle">
              Give up this attempt (starts the cooldown)
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main>
      <HeroBand title={`rank_${rank}_challenge`} kicker={`> ${rankName(rank)} → ${next}`} />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <TerminalPanel title="rules">
          <ul className="list-disc space-y-1 pl-6 text-muted">
            <li>
              {summary.timeLimitMinutes} minutes, starting when you press Start. The clock is checked on the server.
            </li>
            <li>Your machine is generated just for you — answers differ from anyone else&apos;s.</li>
            <li>If time runs out or you give up, you can retry after a {lab.challenge!.cooldown_minutes}-minute cooldown with a new machine.</li>
          </ul>
        </TerminalPanel>

        {state.kind === "locked" && (
          <section>
            <p className="mb-4 text-ink">Finish every Rank {rank} lesson to unlock the challenge:</p>
            <ul className="space-y-1 text-muted">
              {summary.lessons.map((l) => (
                <li key={l.id}>
                  {l.status === "completed" ? "✓" : "·"}{" "}
                  <Link href={`/learn/${l.id}`} className="underline hover:text-cyan">
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {state.kind === "cooldown" && (
          <p className="text-pink">
            Cooldown — you can try again after{" "}
            <time dateTime={state.retryAt}>{new Date(state.retryAt).toUTCString().slice(17, 22)} UTC</time>.
          </p>
        )}

        {state.kind === "ready" && (
          <form action={startChallengeAction.bind(null, rank)}>
            <button type="submit" className={button}>
              Start the challenge
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

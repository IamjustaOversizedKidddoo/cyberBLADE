import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/identity/session";
import { BETA_NOTICE_VERSION, getBetaStore, isBetaInviteOnly } from "@/lib/beta";
import { BETA_NOTICE_POINTS, BETA_NOTICE_TITLE } from "@/lib/beta/notice";
import { acknowledgeBetaNoticeAction } from "./actions";

export const metadata: Metadata = { title: "Beta notice · CyberBLADE" };

export default async function BetaNoticePage() {
  const operator = await requireOperator();
  if (!isBetaInviteOnly() || (await getBetaStore().hasAckedNotice(operator.id, BETA_NOTICE_VERSION))) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 font-sans text-base text-ink sm:px-6">
      <h1 className="font-ui text-2xl">{BETA_NOTICE_TITLE}</h1>
      <ul className="mt-6 list-disc space-y-3 pl-5 text-secondary">
        {BETA_NOTICE_POINTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <form action={acknowledgeBetaNoticeAction} className="mt-8 flex flex-wrap items-center gap-4">
        <button type="submit" className="min-h-[44px] rounded-xs border border-cyan bg-cyan/15 px-5 font-ui text-sm font-semibold text-cyan hover:bg-cyan/25 focus-visible:outline-2 focus-visible:outline-cyan">
          I understand, continue
        </button>
        <Link href="/help" className="text-cyan underline underline-offset-4 hover:text-ink">Read Help first</Link>
      </form>
      <p className="mt-6 text-sm text-muted">Notice version {BETA_NOTICE_VERSION}. We record the time you acknowledge it.</p>
    </main>
  );
}

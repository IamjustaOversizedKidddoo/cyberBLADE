import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { requireOperator } from "@/lib/identity/session";
import { BETA_NOTICE_VERSION, getBetaStore, isBetaInviteOnly } from "@/lib/beta";
import { BETA_BANNER_TEXT } from "@/lib/beta/notice";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const operator = await requireOperator();
  const beta = isBetaInviteOnly();
  // Closed beta: the one-time notice must be acknowledged (timestamped) before using the app.
  if (beta && !(await getBetaStore().hasAckedNotice(operator.id, BETA_NOTICE_VERSION))) redirect("/beta-notice");
  return (
    <AppShell operator={operator}>
      {beta && (
        <p className="border-b border-line bg-surface-subtle px-4 py-2 text-center font-sans text-sm text-secondary">
          {BETA_BANNER_TEXT}{" "}
          <Link href="/help" className="text-cyan underline underline-offset-4 hover:text-ink">Help</Link>
        </p>
      )}
      {children}
      <div className="fixed bottom-4 right-4 z-[2] print:hidden">
        <FeedbackDialog label="Feedback" className="min-h-[44px] rounded-xs border border-cyan bg-surface-raised px-4 font-ui text-sm text-cyan shadow-lg hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-cyan" />
      </div>
    </AppShell>
  );
}

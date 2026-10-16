import type { Metadata } from "next";
import Link from "next/link";
import { requireOperator } from "@/lib/identity/session";
import { AccountDataControls } from "@/components/account/AccountDataControls";

export const metadata: Metadata = { title: "Account · CyberBLADE" };

export default async function AccountPage() {
  const operator = await requireOperator();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 font-sans text-sm sm:px-6">
      <h1 className="font-ui text-2xl text-ink">Account</h1>
      <p className="text-secondary">Signed in as <strong className="text-ink">{operator.handle}</strong>. Questions about your data? See <Link href="/help" className="text-cyan underline underline-offset-4 hover:text-ink">Help</Link>.</p>
      <AccountDataControls />
    </main>
  );
}

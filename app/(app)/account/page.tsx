import type { Metadata } from "next";
import Link from "next/link";
import { requireOperator } from "@/lib/identity/session";
import { AccountDataControls } from "@/components/account/AccountDataControls";

export const metadata: Metadata = { title: "Account · CyberBLADE" };

export default async function AccountPage() {
  const operator = await requireOperator();
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 font-sans text-sm sm:px-6">
      <div className="space-y-2 border-b border-line pb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-cyan">&gt; OPERATIVE PROFILE // SECURITY CLEARANCE</p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-tight text-ink leading-[0.95]">Operator Dossier</h1>
      </div>

      {/* Operative Dossier Card */}
      <div className="rounded-sm border border-cyan/40 bg-surface/80 p-5 shadow-[0_0_25px_rgba(15,190,255,0.08)] relative overflow-hidden">
        <div className="absolute right-4 top-4 font-mono text-[10px] text-cyan/70 uppercase tracking-widest border border-cyan/30 px-2 py-0.5 rounded-xs bg-cyan/5">
          SECTOR // AUTH-CLEARED
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xs border-2 border-cyan bg-console font-display text-3xl text-cyan shadow-inner">
            {String(operator.rank).padStart(2, "0")}
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted">OPERATIVE_HANDLE</div>
            <div className="font-mono text-xl font-bold text-ink">{operator.handle}</div>
            <div className="mt-1 flex items-center gap-2 font-ui text-xs text-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              <span>CLEARANCE: RANK {operator.rank} OPERATIVE</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-secondary">Questions about your data or rights? See <Link href="/help" className="text-cyan underline underline-offset-4 hover:text-ink">Help & Support</Link>.</p>
      <AccountDataControls />
    </main>
  );
}

import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <HeroBand title="404_not_found" kicker="> no such path on this machine">
        <p className="text-secondary">The page you asked for doesn&apos;t exist — or it was relocated.</p>
      </HeroBand>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-12">
        <Link href="/dashboard" className="border-2 border-cyan bg-cyan/10 px-6 py-2.5 font-ui text-sm text-cyan hover:bg-cyan hover:text-void transition-colors">
          Go to Dashboard
        </Link>
        <Link href="/learn/core" className="border border-line bg-surface-subtle px-6 py-2.5 font-ui text-sm text-ink hover:border-cyan hover:text-cyan transition-colors">
          Curriculum Map
        </Link>
        <Link href="/" className="font-ui text-sm text-muted hover:text-ink transition-colors">
          Public Home ›
        </Link>
      </div>
    </main>
  );
}

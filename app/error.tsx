"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log privately without exposing stack traces to the user
    console.error("Runtime exception caught by boundary:", error.digest || "redacted");
  }, [error]);

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <HeroBand title="system_malfunction" kicker="> unexpected exception trapped">
        <p>A tactical subsystem encountered an unhandled exception. Your session remains secure.</p>
      </HeroBand>
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
        <div className="border border-line bg-surface p-6 rounded-xs space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-rose">
            <span className="h-2 w-2 rounded-full bg-rose" />
            <span>DIAGNOSTIC STATUS // CONTAINED</span>
          </div>
          <p className="text-secondary font-sans text-sm">
            The error was isolated to prevent state leakage. You can retry mounting the current view or return to the operations dashboard.
          </p>
          {error.digest && (
            <p className="text-muted text-xs">INCIDENT REF: {error.digest}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-4 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="border-2 border-cyan bg-cyan/10 px-6 py-2.5 font-ui text-sm text-cyan hover:bg-cyan hover:text-void transition-colors"
          >
            Retry Subsystem
          </button>
          <Link
            href="/dashboard"
            className="border border-line bg-surface-subtle px-6 py-2.5 font-ui text-sm text-ink hover:border-cyan hover:text-cyan transition-colors"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/"
            className="border border-line bg-surface-subtle px-6 py-2.5 font-ui text-sm text-muted hover:text-ink transition-colors"
          >
            Public Home
          </Link>
        </div>
      </div>
    </main>
  );
}

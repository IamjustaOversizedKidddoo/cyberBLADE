"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SocSessionClient } from "@/lib/lab-engine/soc/types";
import { getSocSessionAction } from "@/app/(app)/labs/soc/actions";
import { SocWorkspace } from "@/components/labs/soc/SocWorkspace";

/** Read-only review of a submitted exam's workspace: the scorecard with debriefs opens by default. */
export function SocLabReview({ attemptId, backHref }: { attemptId: string; backHref: string }) {
  const [session, setSession] = useState<SocSessionClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getSocSessionAction(attemptId).then(setSession).catch((e) => setError(e instanceof Error ? e.message : "Could not load the review."));
  }, [attemptId]);
  return (
    <div className="bg-canvas">
      <p className="border-b border-line bg-surface px-4 py-2 font-ui text-sm">
        <Link href={backHref} className="text-cyan underline underline-offset-4 hover:text-ink">Back to your exam result</Link>
      </p>
      {error ? <p role="alert" className="p-6 text-sm text-ink">{error}</p> : session ? <SocWorkspace session={session} /> : <p role="status" className="p-6 font-ui text-sm text-muted">Loading review…</p>}
    </div>
  );
}

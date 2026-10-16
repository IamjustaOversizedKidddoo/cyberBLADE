"use client";

import { useEffect, useState } from "react";
import type { SocSessionClient } from "@/lib/lab-engine/soc/types";
import { startSocSessionAction } from "@/app/(app)/labs/soc/actions";
import { SocWorkspace } from "./SocWorkspace";

type Props = {
  scenarioId: string;
  onExit?: () => void;
  reportsEnabled?: boolean;
};

export function SocLabSessionLoader({ scenarioId, onExit, reportsEnabled = true }: Props) {
  const [session, setSession] = useState<SocSessionClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const s = await startSocSessionAction(scenarioId);
        if (mounted) {
          setSession(s);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load SOC session");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [scenarioId]);

  if (loading) {
    return (
      <div className="h-[520px] rounded-sm border border-line bg-console p-6 font-mono text-xs text-muted flex flex-col items-center justify-center space-y-3">
        <div className="h-6 w-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
        <span className="text-cyan font-semibold">Initializing SOC Operator Environment [{scenarioId}]…</span>
        <span className="text-[11px] text-muted">Mounting telemetry queue and case store</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="h-[320px] rounded-sm border border-danger/40 bg-console p-6 font-mono text-xs text-danger flex flex-col items-center justify-center space-y-3">
        <span className="font-bold text-sm">Failed to Launch SOC Workspace</span>
        <p className="text-muted text-center max-w-md">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xs border border-line bg-surface-raised px-4 py-1.5 text-ink hover:bg-surface-hover"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return <SocWorkspace session={session} onExit={onExit} reportsEnabled={reportsEnabled} />;
}

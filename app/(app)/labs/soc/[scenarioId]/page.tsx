import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/identity/session";
import { isSocWorkspaceEnabled } from "@/lib/config/env";
import { loadSocScenario } from "@/lib/lab-engine/soc/engine";
import { SocLabSessionLoader } from "@/components/labs/soc/SocLabSessionLoader";
import { HandlerDrawer } from "@/components/handler/HandlerDrawer";

export async function generateMetadata(
  props: { params: Promise<{ scenarioId: string }> },
): Promise<Metadata> {
  const { scenarioId } = await props.params;
  try {
    const scenario = await loadSocScenario(scenarioId);
    return { title: `${scenario.title} · SOC Workspace` };
  } catch {
    return { title: "SOC Workspace · CyberBLADE" };
  }
}

export default async function SocScenarioPage(
  props: { params: Promise<{ scenarioId: string }> },
) {
  const { scenarioId } = await props.params;
  const operator = await requireOperator();

  // Feature Flag: graceful degradation when off
  if (!isSocWorkspaceEnabled()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center space-y-6">
        <div className="rounded-xs border border-warning/40 bg-warning/10 p-8 space-y-4">
          <span className="font-mono text-xs uppercase tracking-widest text-warning font-bold">
            FEATURE FLAG: SOC_WORKSPACE_ENABLED = FALSE
          </span>
          <h1 className="font-mono text-2xl font-bold text-ink">
            SOC Tier-1 Workspace Under Evaluation
          </h1>
          <p className="text-secondary text-sm leading-relaxed max-w-lg mx-auto">
            The Phase 3 SOC incident response simulator is currently restricted to staging and preview environments. Contact your CyberBLADE administrator to enable preview flags.
          </p>
          <div className="pt-4">
            <Link
              href="/labs"
              className="inline-flex rounded-xs border border-line bg-surface-raised px-5 py-2 text-xs font-mono font-bold text-ink hover:bg-surface-hover"
            >
              ← Return to Tactical Labs Directory
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Load scenario to verify validity
  try {
    await loadSocScenario(scenarioId);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-void">
      <div className="p-2 sm:p-4">
        <SocLabSessionLoader scenarioId={scenarioId} />
      </div>

      <HandlerDrawer
        context={{
          kind: "lab",
          labId: `soc-${scenarioId}`,
          labTitle: `SOC: ${scenarioId}`,
          rank: 1,
          objectives: [],
        }}
        operatorHandle={operator.handle}
      />
    </div>
  );
}

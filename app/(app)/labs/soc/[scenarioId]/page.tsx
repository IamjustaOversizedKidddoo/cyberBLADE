import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/identity/session";
import { isSocReportsEnabled, isSocWorkspaceEnabled } from "@/lib/config/env";
import { loadSocFamily, loadSocScenario, loadSocShift } from "@/lib/lab-engine/soc/engine";
import { SocLabSessionLoader } from "@/components/labs/soc/SocLabSessionLoader";
import { HandlerDrawer } from "@/components/handler/HandlerDrawer";

/** Resolves the same three id kinds startSocSession accepts: shifts, families and static scenarios. */
async function loadSocLabTitle(scenarioId: string): Promise<string> {
  // Ids become file paths in the loaders; reject anything that is not a plain slug.
  if (!/^[a-z0-9-]{1,80}$/.test(scenarioId)) throw new Error("invalid SOC lab id");
  if (scenarioId.startsWith("shift-")) return (await loadSocShift(scenarioId)).title;
  if (scenarioId.startsWith("soc-f-")) return (await loadSocFamily(scenarioId)).metadata.title;
  return (await loadSocScenario(scenarioId)).title;
}

export async function generateMetadata(
  props: { params: Promise<{ scenarioId: string }> },
): Promise<Metadata> {
  const { scenarioId } = await props.params;
  try {
    return { title: `${await loadSocLabTitle(scenarioId)} · SOC Workspace` };
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
          <h1 className="font-mono text-2xl font-bold text-ink">
            The SOC workspace is not open yet
          </h1>
          <p className="text-secondary text-sm leading-relaxed max-w-lg mx-auto">
            Hands-on SOC scenarios are still being reviewed. The lessons are available in the meantime.
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
    await loadSocLabTitle(scenarioId);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-void">
      <div className="p-2 sm:p-4">
        <SocLabSessionLoader scenarioId={scenarioId} reportsEnabled={isSocReportsEnabled()} />
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

/**
 * Which practice targets can open with the current SOC feature flags (L1-A-07). One rule for the
 * lesson page, track paths (and their minutes), the exam study plan and the exam lobby, so a flag
 * that is off hides a target everywhere instead of leaving a link to a "not enabled" page.
 */
export type PracticeFlags = { workspace: boolean; enrichment: boolean; query: boolean; reports?: boolean };

export function practiceTargetAvailable(target: string, flags: PracticeFlags): boolean {
  const kind = target.split(":")[0];
  if (kind === "drill") return flags.query;
  if (kind === "report") return flags.workspace && flags.reports !== false;
  if (kind === "family" || kind === "shift") return flags.workspace;
  if (kind === "tool") return flags.workspace && flags.enrichment;
  return true; // lessons and anything without a feature flag
}

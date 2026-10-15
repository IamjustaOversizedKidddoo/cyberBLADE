/**
 * IOC balancing (generator 1.1.0, L1-A-03). Before it, only true-positive alert templates listed
 * IOCs, so "this alert has an IOC chip" meant "malicious" with 100% precision. Real alerts list the
 * observables they mention whatever the verdict, so every non-true-positive alert now carries the
 * observables already present in its own fields (or, failing that, the related asset's address).
 * True-positive alerts keep exactly their template IOCs, so report and enrichment answer keys for
 * malicious indicators do not change. Pure and deterministic: no randomness, no new values.
 */
import type { SocAlertIoc, SocScenario } from "./schema";

export const IOC_BALANCING_FROM = "1.1.0";

export function usesIocBalancing(generatorVersion: string | null | undefined): boolean {
  const v = (generatorVersion ?? "1.0.0").split(".").map(Number);
  const min = IOC_BALANCING_FROM.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== min[i]) return (v[i] ?? 0) > min[i];
  return true;
}

const FILE_EXT = /\.(exe|dll|ps1|psm1|bat|cmd|vbs|js|jar|msi|iso|lnk|zip|rar|7z|pdf|docx?|xlsx?|pptx?|txt|log|csv|json|xml|html?|png|jpe?g|gif|sys|tmp|dat|ini|cfg|conf|sh|py)$/i;
const PATTERNS: Array<[SocAlertIoc["type"], RegExp]> = [
  ["hash", /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i],
  ["email", /^[^\s@]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i],
  ["url", /^https?:\/\/[^\s]+$/i],
  ["ip", /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/],
  ["domain", /^(?=[^.]*[a-z])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i],
];

/** Observables literally present in an alert's raw fields, in field order, de-duplicated. */
export function fieldObservables(rawFields: Record<string, string | number | boolean>, max = 2): SocAlertIoc[] {
  const out: SocAlertIoc[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(rawFields)) {
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (!v || /\s/.test(v) || seen.has(v.toLowerCase())) continue;
    const hit = PATTERNS.find(([type, re]) => re.test(v) && !(type === "domain" && FILE_EXT.test(v)));
    if (!hit) continue;
    seen.add(v.toLowerCase());
    out.push({ type: hit[0], value: v });
    if (out.length >= max) break;
  }
  return out;
}

export function balanceAlertIocs(scenario: SocScenario): SocScenario {
  const ipByHost = new Map(scenario.environment.assets.map((a) => [a.hostname, a.ip]));
  return {
    ...scenario,
    alerts: scenario.alerts.map((a) => {
      if (a.groundTruth.kind === "true_positive" || a.relatedIocs.length > 0) return a;
      const observed = fieldObservables(a.rawFields);
      const assetIp = a.relatedAsset ? ipByHost.get(a.relatedAsset) : undefined;
      const relatedIocs = observed.length ? observed : assetIp ? [{ type: "ip" as const, value: assetIp }] : [];
      return { ...a, relatedIocs };
    }),
  };
}

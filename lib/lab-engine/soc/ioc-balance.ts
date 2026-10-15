/**
 * IOC balancing (generator 1.1.0, L1-A-03). Before it, only true-positive alert templates listed
 * IOCs, so "this alert has an IOC chip" meant "malicious" with 100% precision. Real alerts list the
 * observables they mention whatever the verdict, so every non-true-positive alert now carries the
 * observables already present in its own fields (or, failing that, the related asset's address).
 * True-positive alerts keep exactly their template IOCs, so report and enrichment answer keys for
 * malicious indicators do not change. Pure and deterministic: no randomness, no new values.
 */
import { createRng } from "@/lib/generators/rng";
import type { SocAlertIoc, SocScenario } from "./schema";

export const IOC_BALANCING_FROM = "1.1.0";
/** Benign "roaming user" address used by noise generation in both generators. */
export const NOISE_ROAMING_IP = "198.51.100.201";
export const SEEDED_IOCS_FROM = "1.2.0";

function atLeast(generatorVersion: string | null | undefined, min: string): boolean {
  const v = (generatorVersion ?? "1.0.0").split(".").map(Number);
  const m = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== m[i]) return (v[i] ?? 0) > m[i];
  return true;
}

export const usesIocBalancing = (generatorVersion: string | null | undefined) => atLeast(generatorVersion, IOC_BALANCING_FROM);
export const usesSeededIocs = (generatorVersion: string | null | undefined) => atLeast(generatorVersion, SEEDED_IOCS_FROM);

const WORDS_A = ["account", "secure", "verify", "billing", "portal", "update", "signin", "invoice", "payroll", "support", "docs", "cloud", "mail", "auth", "service", "notice", "share", "vendor", "remit", "session"];
const WORDS_B = ["center", "hub", "desk", "online", "access", "gateway", "check", "review", "files", "link", "zone", "point", "site", "login", "pass", "team", "office", "web", "net", "now"];

/**
 * Generator 1.2.0 (L1-A-09): true-positive indicator values are drawn per seed instead of from
 * a handful of fixed values, so "this IP was bad last time" carries no information. Values stay in
 * reserved documentation space (RFC 5737 addresses; .example / .test domains). Uses its own RNG
 * sub-stream, so every other generated value is unchanged.
 */
export function seededIncidentIocs(streamSeed: string, pooled: { attackerIp: string }, avoid: ReadonlySet<string> = new Set()) {
  const rng = createRng(`${streamSeed}:ioc-values`);
  const prefix = pooled.attackerIp.split(".").slice(0, 3).join(".");
  const label = () => `${rng.pick(WORDS_A)}-${rng.pick(WORDS_B)}${rng.int(2, 99)}`;
  const tld = () => rng.pick([".example", ".test"]);
  // Never reuse a value the content already uses (benign noise has fixed reserved addresses), or a
  // benign alert would share the attacker's indicator.
  const taken = (v: string) => avoid.has(v.toLowerCase()) || v === NOISE_ROAMING_IP;
  const fresh = (make: () => string) => {
    let v = make();
    for (let i = 0; i < 50 && taken(v); i++) v = make();
    return v;
  };
  return {
    attackerIp: fresh(() => `${prefix}.${rng.int(2, 253)}`),
    phishingDomain: fresh(() => `${rng.pick(WORDS_A)}.${label()}${tld()}`),
    c2Domain: fresh(() => `${rng.pick(["cdn", "api", "sync", "telemetry", "assets"])}.${label()}${tld()}`),
    fileHash: rng.hex(64),
  };
}

const RESERVED_LITERAL = /\b(?:(?:198\.51\.100|203\.0\.113|192\.0\.2)\.\d{1,3}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:example|test))\b/gi;
const literalCache = new WeakMap<object, Set<string>>();

/** Reserved IPs and domains written literally anywhere in the given content objects (cached). */
export function reservedLiterals(...sources: object[]): Set<string> {
  const out = new Set<string>();
  for (const src of sources) {
    let set = literalCache.get(src);
    if (!set) {
      set = new Set((JSON.stringify(src).match(RESERVED_LITERAL) ?? []).map((v) => v.toLowerCase()));
      literalCache.set(src, set);
    }
    for (const v of set) out.add(v);
  }
  return out;
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

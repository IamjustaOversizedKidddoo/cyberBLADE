/**
 * Published-version pinning (L1-A-11). Each family and shift version, together with the generator
 * version, has a fixed fingerprint: the hash of the full scenario (alerts, raw events, indicators,
 * ground truth) generated from a reference seed. `content/soc/published-hashes.json` records them,
 * and a unit test fails when content changes but its version does not, because existing attempts
 * regenerate from the same id, version and seed and would otherwise be re-graded silently.
 *
 * After an intentional content change: bump the family or shift `version`, then run
 *   npm run soc:pin-hashes
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "./family-schema";
import { shiftProfileSchema, type ShiftProfile } from "./shift-schema";
import { generateSocVariant, GENERATOR_VERSION } from "./generator";
import { composeShiftScenario } from "./shift-composer";

export const PUBLISHED_HASHES_FILE = "content/soc/published-hashes.json";
const REFERENCE_SEED = "published-reference-seed";

const sha = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function readDir<T>(dir: string, parse: (x: unknown) => T): T[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => parse(parseYaml(fs.readFileSync(path.join(dir, f), "utf8"))));
}

/** Current fingerprints, keyed "<id>@<content version>+gen<generator version>". */
export function currentFingerprints(root = "content/soc"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readDir(path.join(root, "families"), (x) => socFamilySchema.parse(x) as SocFamily)) {
    out[`${f.metadata.id}@${f.metadata.version}+gen${GENERATOR_VERSION}`] = sha(generateSocVariant(f, REFERENCE_SEED, "intermediate").scenario);
  }
  for (const s of readDir(path.join(root, "shifts"), (x) => shiftProfileSchema.parse(x) as ShiftProfile)) {
    out[`${s.id}@${s.version}+gen${GENERATOR_VERSION}`] = sha(composeShiftScenario(s, REFERENCE_SEED));
  }
  return out;
}

export function readPublishedHashes(file = PUBLISHED_HASHES_FILE): Record<string, string> {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>) : {};
}

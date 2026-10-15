/**
 * Records the fingerprint of every current family/shift version in content/soc/published-hashes.json
 * (L1-A-11). Existing entries are kept (old versions stay pinned); an entry whose fingerprint
 * changed without a version bump is refused, not overwritten.
 *   npm run soc:pin-hashes
 */
import fs from "node:fs";
import { PUBLISHED_HASHES_FILE, currentFingerprints, readPublishedHashes } from "../lib/lab-engine/soc/published-hashes.js";

const pinned = readPublishedHashes();
const now = currentFingerprints();
const changed = Object.entries(now).filter(([k, v]) => pinned[k] && pinned[k] !== v).map(([k]) => k);
if (changed.length) {
  console.error(`Content changed without a version bump: ${changed.join(", ")}. Bump the version in the YAML first.`);
  process.exit(1);
}
const merged = Object.fromEntries(Object.entries({ ...pinned, ...now }).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(PUBLISHED_HASHES_FILE, JSON.stringify(merged, null, 2) + "\n");
console.log(`Pinned ${Object.keys(now).length} current versions (${Object.keys(merged).length} entries in total).`);

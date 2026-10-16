/**
 * Read-only smoke test of a deployed site (local next start, staging or production).
 *   npm run smoke -- https://example.com [--indexable]   (--indexable once the beta is public)
 */
import { runSmoke } from "../lib/ops/smoke";

const base = process.argv.slice(2).find((a) => /^https?:\/\//.test(a));
if (!base) {
  console.error("usage: npm run smoke -- <baseUrl> [--indexable]");
  process.exit(1);
}
const { checks, requests } = await runSmoke(base, fetch, { expectNoindex: !process.argv.includes("--indexable") });
console.log(`Smoke (${requests} requests to ${new URL(base).host})`);
for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
const failed = checks.some((c) => !c.ok);
console.log(failed ? "SMOKE FAILED" : "SMOKE PASSED");
process.exit(failed ? 1 : 0);

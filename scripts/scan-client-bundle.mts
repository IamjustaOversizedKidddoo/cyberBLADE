/**
 * Post-build gate: fails if client bundles or prerendered HTML/RSC payloads contain anything that
 * must stay on the server (see lib/security/bundle-scan.ts). Run after `npm run build`.
 *   npm run scan:bundle
 */
import fs from "node:fs";
import { clientArtifactRoots, scanForLeaks } from "../lib/security/bundle-scan";

if (!fs.existsSync(".next/static")) {
  console.error("scan:bundle needs a build: run `npm run build` first.");
  process.exit(1);
}

const { files, hits } = scanForLeaks(clientArtifactRoots());
if (files < 10) {
  console.error(`scan:bundle scanned only ${files} files; the build output looks incomplete.`);
  process.exit(1);
}
if (hits.length) {
  console.error(`scan:bundle FAILED: ${hits.length} leak(s) in ${files} client artifacts`);
  for (const h of hits.slice(0, 50)) console.error(` - [${h.rule}] ${h.file}: …${h.excerpt}…`);
  process.exit(1);
}
console.log(`scan:bundle OK: ${files} client artifacts, no leaks.`);

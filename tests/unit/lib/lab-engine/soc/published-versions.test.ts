/**
 * L1-A-11 regression: published family/shift versions are immutable. Fails when a family or shift
 * changes (directly, or through a family a shift composes) without a version bump, or when a new
 * version is not pinned yet. Fix: bump `version` in the YAML, then `npm run soc:pin-hashes`.
 */
import { describe, expect, it, vi } from "vitest";
vi.setConfig({ testTimeout: 60_000 });
vi.mock("server-only", () => ({}));

import { currentFingerprints, readPublishedHashes } from "@/lib/lab-engine/soc/published-hashes";
import { makeCtx } from "./ai-grading/pipeline-harness";
import { resolveScenarioForAttempt, startSocSession } from "@/lib/lab-engine/soc/engine";

describe("L1-A-11: published SOC content versions are pinned", () => {
  it("every current family and shift version matches its pinned fingerprint", () => {
    const pinned = readPublishedHashes();
    const now = currentFingerprints();
    const unpinned = Object.keys(now).filter((k) => !pinned[k]);
    const changed = Object.keys(now).filter((k) => pinned[k] && pinned[k] !== now[k]);
    expect(unpinned, "new versions: run npm run soc:pin-hashes").toEqual([]);
    expect(changed, "content changed without a version bump: bump the YAML version, then npm run soc:pin-hashes").toEqual([]);
  });

  it("a shift attempt refuses to open against changed content (hash check, as for families)", async () => {
    const ctx = makeCtx({ t: new Date("2026-10-15T10:00:00Z") });
    const s = await startSocSession(ctx, "u-a11", "shift-quiet-day");
    const attempt = (await ctx.repo.getSocAttempt(s.attempt.id))!;
    await expect(resolveScenarioForAttempt(attempt)).resolves.toBeDefined();
    await expect(resolveScenarioForAttempt({ ...attempt, scenarioHash: "0".repeat(64) })).rejects.toThrow("hash mismatch");
  });
});

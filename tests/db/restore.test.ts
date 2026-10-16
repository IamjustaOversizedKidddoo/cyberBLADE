/** Restore check on synthetic data in PGlite: passes on a good backup, and each check can fail. */
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptBackup, makeManifest } from "@/lib/ops/backup";
import { buildSyntheticBundle, restoreAndCheck } from "@/lib/ops/restore";

const key = crypto.randomBytes(32);

async function run(bundle: string, tweak?: (m: ReturnType<typeof makeManifest>) => void) {
  const plain = Buffer.from(bundle);
  const file = encryptBackup(plain, key);
  const manifest = makeManifest("t", file, plain, "test");
  tweak?.(manifest);
  const report = await restoreAndCheck(file, manifest, key);
  return { report, failed: report.checks.filter((c) => !c.ok).map((c) => c.name) };
}

describe("restoreAndCheck", { timeout: 60_000 }, () => {
  it("restores a synthetic backup with every check passing", async () => {
    const { report, failed } = await run(buildSyntheticBundle(5));
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.rows).toBe(5 * 8);
  });

  it("fails when rows are missing or the manifest was edited", async () => {
    const { failed } = await run(buildSyntheticBundle(3), (m) => {
      m.tables["public.operators"] = 4;
    });
    expect(failed).toEqual(expect.arrayContaining(["row counts match manifest", "manifest matches dump contents"]));
  });

  it("fails when a table lost RLS or a policy leaks other learners' rows", async () => {
    const bundle = `${buildSyntheticBundle(3)}
ALTER TABLE public.learner_feedback DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.lesson_progress TO authenticated;
CREATE POLICY leak ON public.lesson_progress FOR SELECT TO authenticated USING (true);
`;
    const { failed } = await run(bundle);
    expect(failed).toEqual(expect.arrayContaining(["RLS enabled on every public table", "learners see no other learner's rows"]));
  });
});

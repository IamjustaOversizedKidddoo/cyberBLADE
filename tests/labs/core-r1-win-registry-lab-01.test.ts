import { describe, expect, it } from "vitest";
import { FLAG, MANY_SEEDS, openLab, SEEDS } from "./helpers";

const LAB = "core-r1-win-registry-lab-01";

describe(LAB, () => {
  it.each(SEEDS)("solves lab with seed %s like a learner", async (seed) => {
    const { run, check, answers } = await openLab(LAB, seed);

    // o1: identify rogue run key name
    const runKeyOut = run("Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run").stdout;
    expect(runKeyOut).toContain(answers.runKeyName);
    expect(check("o1", answers.runKeyName)).toBe(true);

    // o2: identify full binary path
    expect(runKeyOut).toContain(answers.runBinaryPath);
    expect(check("o2", answers.runBinaryPath)).toBe(true);

    // o3: identify service image path
    const svcKey = Object.keys(answers).find((k) => k === "serviceImagePath");
    expect(svcKey).toBeDefined();
    expect(check("o3", answers.serviceImagePath)).toBe(true);

    // o4: extract audit flag
    const auditFlagOut = run("Get-ItemProperty HKLM:\\SOFTWARE\\CyberBlade\\Audit -Name Flag").stdout.trim();
    expect(auditFlagOut).toMatch(FLAG);
    expect(check("o4", auditFlagOut)).toBe(true);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: valid answers and flag for 1000 seeds", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { answers, check } = await openLab(LAB, seed);
      if (!FLAG.test(answers.flag)) {
        bad.push(`${seed}: invalid flag format ${answers.flag}`);
      }
      if (!check("o1", answers.runKeyName)) {
        bad.push(`${seed}: o1 failed`);
      }
      if (!check("o2", answers.runBinaryPath)) {
        bad.push(`${seed}: o2 failed`);
      }
      if (!check("o3", answers.serviceImagePath)) {
        bad.push(`${seed}: o3 failed`);
      }
      if (!check("o4", answers.flag)) {
        bad.push(`${seed}: o4 failed`);
      }
    }
    expect(bad).toEqual([]);
  });
});

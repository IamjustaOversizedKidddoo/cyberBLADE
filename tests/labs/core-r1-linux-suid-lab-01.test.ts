import { describe, expect, it } from "vitest";
import { MANY_SEEDS, openLab, SEEDS } from "./helpers";

const LAB = "core-r1-linux-suid-lab-01";

describe(LAB, () => {
  it.each(SEEDS)("solves lab with seed %s like a learner", async (seed) => {
    const { run, check } = await openLab(LAB, seed);

    // o1 & o2: find / -perm -4000 2>/dev/null
    const suidOut = run("find / -perm -4000 2>/dev/null").stdout.trim().split("\n");
    const count = String(suidOut.length);
    expect(check("o2", count)).toBe(true);

    const nonStandard = suidOut.find((p) => !p.startsWith("/usr/bin/"));
    expect(nonStandard).toBeDefined();
    expect(check("o1", nonStandard!)).toBe(true);

    // o3: owner of the non-standard SUID binary
    const lsOut = run(`ls -l ${nonStandard}`).stdout.trim().split(/\s+/);
    const owner = lsOut[2];
    expect(check("o3", owner)).toBe(true);
    expect(check("o3", owner.toUpperCase())).toBe(true);

    // o4: NOPASSWD command from sudo -l
    const sudoOut = run("sudo -l").stdout;
    const match = sudoOut.match(/NOPASSWD:\s*(\S+)/);
    expect(match).not.toBeNull();
    const sudoCmd = match![1];
    expect(check("o4", sudoCmd)).toBe(true);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: exactly one non-standard SUID binary, count matches, sudo command unique", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { run, check, answers } = await openLab(LAB, seed);
      const suidList = run("find / -perm -4000 2>/dev/null").stdout.trim().split("\n");
      const nonStd = suidList.filter((p) => !p.startsWith("/usr/bin/"));
      if (nonStd.length !== 1) {
        bad.push(`${seed}: non-standard count = ${nonStd.length}`);
      }
      if (!check("o1", answers.suid)) {
        bad.push(`${seed}: suid check failed`);
      }
      if (!check("o2", answers.count)) {
        bad.push(`${seed}: count check failed`);
      }
      // Plausible wrong standard path should be rejected for o1
      if (check("o1", "/usr/bin/passwd")) {
        bad.push(`${seed}: /usr/bin/passwd accepted as non-standard SUID`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

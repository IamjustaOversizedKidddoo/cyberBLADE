import { describe, expect, it } from "vitest";
import { MANY_SEEDS, openLab, SEEDS } from "./helpers";

const LAB = "core-r1-win-eventlog-lab-01";

describe(LAB, () => {
  it.each(SEEDS)("solves lab with seed %s like a learner", async (seed) => {
    const { run, check, answers } = await openLab(LAB, seed);

    // o1: Event ID 4625 for failed logons
    expect(check("o1", "4625")).toBe(true);

    // o2: target username
    const secOut = run("Get-WinEvent -LogName Security -Id 4625").stdout;
    expect(secOut).toContain(answers.targetUser);
    expect(check("o2", answers.targetUser)).toBe(true);

    // o3: attacker IP
    expect(secOut).toContain(answers.attackerIp);
    expect(check("o3", answers.attackerIp)).toBe(true);

    // o4: rogue service name in Event ID 7045
    const sysOut = run("Get-WinEvent -LogName System -Id 7045").stdout;
    expect(sysOut).toContain(answers.serviceName);
    expect(check("o4", answers.serviceName)).toBe(true);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: correct answers across 1000 seeds", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { answers, check } = await openLab(LAB, seed);
      if (answers.failedLogonEventId !== "4625") {
        bad.push(`${seed}: bad failedLogonEventId ${answers.failedLogonEventId}`);
      }
      if (!check("o1", "4625")) {
        bad.push(`${seed}: o1 check failed`);
      }
      if (!check("o2", answers.targetUser)) {
        bad.push(`${seed}: o2 check failed`);
      }
      if (!check("o3", answers.attackerIp)) {
        bad.push(`${seed}: o3 check failed`);
      }
      if (!check("o4", answers.serviceName)) {
        bad.push(`${seed}: o4 check failed`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

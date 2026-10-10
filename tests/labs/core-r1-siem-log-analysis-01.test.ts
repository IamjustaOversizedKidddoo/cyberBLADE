import { describe, expect, it } from "vitest";
import { MANY_SEEDS, openSiemLab, SEEDS } from "./helpers";

const LAB = "core-r1-siem-log-analysis-01";

describe(LAB, () => {
  it.each(SEEDS)("solves siem lab with seed %s like a learner", async (seed) => {
    const { siem, check, answers } = await openSiemLab(LAB, seed);

    expect(siem.events.length).toBeGreaterThan(5);

    // o1: external attacker IP
    expect(check("o1", answers.attackerIp)).toBe(true);
    expect(check("o1", "127.0.0.1")).toBe(false);

    // o2: target user account (case insensitive)
    expect(check("o2", answers.targetUser)).toBe(true);
    expect(check("o2", answers.targetUser.toUpperCase())).toBe(true);
    expect(check("o2", "bogus_user")).toBe(false);

    // o3: failed attempts count
    expect(check("o3", answers.failedCount)).toBe(true);
    expect(check("o3", "99")).toBe(false);

    // o4: backdoor service name
    expect(check("o4", answers.serviceName)).toBe(true);
    expect(check("o4", answers.serviceName.toUpperCase())).toBe(true);

    // o5: C2 flag token
    expect(check("o5", answers.flag)).toBe(true);
    expect(check("o5", "FLAG{wrong_token}")).toBe(false);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: correct answers and solvable across 1000 seeds", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { answers, check } = await openSiemLab(LAB, seed);
      if (!answers.attackerIp) bad.push(`${seed}: missing attackerIp`);
      if (!check("o1", answers.attackerIp)) bad.push(`${seed}: o1 failed`);
      if (!check("o2", answers.targetUser)) bad.push(`${seed}: o2 failed`);
      if (!check("o3", answers.failedCount)) bad.push(`${seed}: o3 failed`);
      if (!check("o4", answers.serviceName)) bad.push(`${seed}: o4 failed`);
      if (!check("o5", answers.flag)) bad.push(`${seed}: o5 failed`);
    }
    expect(bad).toEqual([]);
  }, 60_000);
});

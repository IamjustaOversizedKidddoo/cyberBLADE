import { describe, expect, it } from "vitest";
import { FLAG, MANY_SEEDS, openLab, SEEDS } from "./helpers";

const LAB = "core-r1-challenge-01";

describe(LAB, () => {
  it.each(SEEDS)("solves challenge with seed %s like an operator", async (seed) => {
    const { run, check, lab, answers } = await openLab(LAB, seed);
    expect(lab.challenge).toEqual({ rank: 1, time_limit_minutes: 30, cooldown_minutes: 30 });

    // o1: external destination IP
    const report = run("cat ~/Triage/incident-report.txt").stdout;
    expect(report).toContain(answers.beaconIp);
    expect(check("o1", answers.beaconIp)).toBe(true);

    // o2: external beacon domain
    expect(report).toContain(answers.beaconDomain);
    expect(check("o2", answers.beaconDomain)).toBe(true);

    // o3: rogue run key name
    const runKeyOut = run("Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run").stdout;
    expect(runKeyOut).toContain(answers.rogueRunName);
    expect(check("o3", answers.rogueRunName)).toBe(true);

    // o4: compromised user in event 4624
    const secLog = run("Get-WinEvent -LogName Security -Id 4624").stdout;
    expect(secLog).toContain(answers.compromisedUser);
    expect(check("o4", answers.compromisedUser)).toBe(true);

    // o5: containment flag
    const flagOut = run("Get-ItemProperty HKLM:\\SOFTWARE\\CyberBlade\\Verification -Name ContainmentFlag").stdout.trim();
    expect(flagOut).toMatch(FLAG);
    expect(check("o5", flagOut)).toBe(true);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: valid answers and flag for 1000 seeds", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { answers, check } = await openLab(LAB, seed);
      if (!FLAG.test(answers.flag)) {
        bad.push(`${seed}: invalid flag ${answers.flag}`);
      }
      if (!check("o1", answers.beaconIp)) {
        bad.push(`${seed}: o1 failed`);
      }
      if (!check("o2", answers.beaconDomain)) {
        bad.push(`${seed}: o2 failed`);
      }
      if (!check("o3", answers.rogueRunName)) {
        bad.push(`${seed}: o3 failed`);
      }
      if (!check("o4", answers.compromisedUser)) {
        bad.push(`${seed}: o4 failed`);
      }
      if (!check("o5", answers.flag)) {
        bad.push(`${seed}: o5 failed`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

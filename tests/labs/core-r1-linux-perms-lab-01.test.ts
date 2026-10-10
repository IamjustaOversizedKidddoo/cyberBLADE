import { describe, expect, it } from "vitest";
import { FLAG, MANY_SEEDS, openLab, SEEDS } from "./helpers";

const LAB = "core-r1-linux-perms-lab-01";

describe(LAB, () => {
  it.each(SEEDS)("solves lab with seed %s like a learner", async (seed) => {
    const { run, check } = await openLab(LAB, seed);

    // o1: calculate octal mode of /srv/app/config.ini from ls -l
    const lsConf = run("ls -l /srv/app/config.ini").stdout.trim().split(/\s+/);
    const modeStr = lsConf[0];
    const u = (modeStr[1] === "r" ? 4 : 0) + (modeStr[2] === "w" ? 2 : 0) + (modeStr[3] === "x" ? 1 : 0);
    const g = (modeStr[4] === "r" ? 4 : 0) + (modeStr[5] === "w" ? 2 : 0) + (modeStr[6] === "x" ? 1 : 0);
    const o = (modeStr[7] === "r" ? 4 : 0) + (modeStr[8] === "w" ? 2 : 0) + (modeStr[9] === "x" ? 1 : 0);
    const octal = `${u}${g}${o}`;
    expect(check("o1", octal)).toBe(true);

    // o2: note is unreadable, then chmod u+r, then cat flag
    expect(run("cat ~/vault/note.txt").stderr).toContain("Permission denied");
    run("chmod u+r ~/vault/note.txt");
    const noteContent = run("cat ~/vault/note.txt").stdout;
    const flagMatch = noteContent.match(FLAG);
    expect(flagMatch).not.toBeNull();
    expect(check("o2", flagMatch![0])).toBe(true);

    // o3: group ownership of /srv/payroll/salaries.csv
    const payrollLs = run("ls -l /srv/payroll/salaries.csv").stdout.trim().split(/\s+/);
    const group = payrollLs[3];
    expect(check("o3", group)).toBe(true);
    expect(check("o3", group.toUpperCase())).toBe(true);

    // o4: the one world-writable file in /srv/shared
    const writableOut = run("find /srv/shared -perm -o+w").stdout.trim().split("\n");
    const writablePath = writableOut[0];
    const writableName = writablePath.split("/").pop()!;
    expect(check("o4", writableName)).toBe(true);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: exactly one world-writable file, vault note unreadable before chmod, correct checks", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { run, check, answers } = await openLab(LAB, seed);
      if (!run("cat ~/vault/note.txt").stderr.includes("Permission denied")) {
        bad.push(`${seed}: note readable before chmod`);
      }
      run("chmod u+r ~/vault/note.txt");
      if (!check("o2", answers.flag)) {
        bad.push(`${seed}: flag check failed`);
      }
      const writableFiles = run("find /srv/shared -perm -o+w").stdout.trim().split("\n");
      if (writableFiles.length !== 1) {
        bad.push(`${seed}: writable files count = ${writableFiles.length}`);
      }
      if (!check("o4", answers.writable)) {
        bad.push(`${seed}: writable check failed`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

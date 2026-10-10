import { describe, expect, it } from "vitest";
import { MANY_SEEDS, openLab, SEEDS } from "./helpers";

const LAB = "core-r1-linux-proc-lab-01";

describe(LAB, () => {
  it.each(SEEDS)("solves lab with seed %s like a learner", async (seed) => {
    const { run, check } = await openLab(LAB, seed);

    const psOut = run("ps -ef").stdout.trim().split("\n");
    // header: UID PID PPID C STIME TTY TIME CMD
    const rows = psOut.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/);
      const uid = parts[0];
      const pid = parts[1];
      const ppid = parts[2];
      const cmd = parts.slice(7).join(" ");
      return { uid, pid, ppid, cmd };
    });

    const susp = rows.find(
      (r) =>
        (r.cmd.startsWith("/tmp/") || r.cmd.startsWith("/dev/shm/")) &&
        !r.cmd.includes("build.sh") &&
        !r.cmd.includes("cleanup.sh"),
    );
    expect(susp).toBeDefined();

    // o1: PID
    expect(check("o1", susp!.pid)).toBe(true);

    // o2: user
    expect(check("o2", susp!.uid)).toBe(true);
    expect(check("o2", susp!.uid.toUpperCase())).toBe(true);

    // o3: parent name
    const parentRow = rows.find((r) => r.pid === susp!.ppid);
    expect(parentRow).toBeDefined();
    const parentProgram = parentRow!.cmd.split(/[: ]/)[0];
    const parentName = parentProgram.slice(parentProgram.lastIndexOf("/") + 1);
    expect(check("o3", parentName)).toBe(true);
    expect(check("o3", parentName.toUpperCase())).toBe(true);

    // o4: remote address host:port
    const remoteMatch = susp!.cmd.match(/(\d+\.\d+\.\d+\.\d+:\d+)/);
    expect(remoteMatch).not.toBeNull();
    const remote = remoteMatch![1];
    expect(check("o4", remote)).toBe(true);
  });
});

describe(`${LAB} across many seeds`, () => {
  it("property test: exactly one suspicious process, decoy PID rejected, correct checks", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { run, check, answers } = await openLab(LAB, seed);
      const rows = run("ps -ef")
        .stdout.trim()
        .split("\n")
        .slice(1)
        .map((l) => l.trim().split(/\s+/));
      const suspRows = rows.filter(
        (r) =>
          (r[7].startsWith("/tmp/") || r[7].startsWith("/dev/shm/")) &&
          !r[7].includes("build.sh") &&
          !r[7].includes("cleanup.sh"),
      );
      if (suspRows.length !== 1) {
        bad.push(`${seed}: suspicious count = ${suspRows.length}`);
      }
      if (!check("o1", answers.pid)) {
        bad.push(`${seed}: PID check failed`);
      }
      // Decoy PID 2250 should be rejected
      if (check("o1", "2250")) {
        bad.push(`${seed}: decoy PID accepted`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

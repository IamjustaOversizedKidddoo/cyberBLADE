import { FLAG, openLab, SEEDS } from "./helpers";

const LAB = "core-r0-files-lab-01";

describe.each(SEEDS)(`${LAB} with seed %s`, (seed) => {
  test("solvable using only the terminal", async () => {
    const { run, check } = await openLab(LAB, seed);
    const listing = run("ls -l ~/shared").stdout.trim().split("\n").slice(1);
    const names = listing.map((line) => line.split(/\s+/).pop()!);

    // o1: the one file cat refuses to open.
    const unreadable = names.filter((n) => run(`cat ~/shared/${n}`).stderr.includes("Permission denied"));
    expect(unreadable).toHaveLength(1);
    expect(check("o1", unreadable[0])).toBe(true);

    // o2: the rw-r--r-- file holds the flag.
    const publicFiles = listing.filter((l) => l.startsWith("-rw-r--r--")).map((l) => l.split(/\s+/).pop()!);
    expect(publicFiles).toHaveLength(1);
    const flag = run(`cat ~/shared/${publicFiles[0]}`).stdout.match(FLAG)![0];
    expect(check("o2", flag)).toBe(true);
  });
});

test("different seeds give different answers", async () => {
  const a = await openLab(LAB, "seed-a");
  const b = await openLab(LAB, "seed-b");
  expect(a.answers.flag).not.toBe(b.answers.flag);
});

test("wrong answers are rejected", async () => {
  const { check, answers } = await openLab(LAB, "seed-a");
  expect(check("o1", "plan.md" === answers.unreadable ? "roster.txt" : "plan.md")).toBe(false);
  expect(check("o2", "CYBERBLADE{000000000000}")).toBe(false);
});

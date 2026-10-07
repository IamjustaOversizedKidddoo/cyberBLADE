import { FLAG, openLab, SEEDS } from "./helpers";

const LAB = "core-r0-terminal-lab-01";

describe.each(SEEDS)(`${LAB} with seed %s`, (seed) => {
  test("solvable using only the terminal", async () => {
    const { run, check } = await openLab(LAB, seed);

    // o1: a hidden file in home holds the first flag.
    const hidden = run("ls -a ~")
      .stdout.split(/\s+/)
      .filter((n) => n.startsWith(".") && n !== "." && n !== "..");
    const flag1 = hidden.map((n) => run(`cat ~/${n}`).stdout.match(FLAG)?.[0]).find(Boolean)!;
    expect(check("o1", flag1)).toBe(true);
    const plain = run("ls ~").stdout.split(/\s+/);
    for (const h of hidden) expect(plain).not.toContain(h);

    // o2: last line of the long backup log.
    expect(run("wc -l /var/log/backup.log").stdout).toBe("300 /var/log/backup.log\n");
    const flag2 = run("tail -n 1 /var/log/backup.log").stdout.match(FLAG)![0];
    expect(check("o2", flag2)).toBe(true);

    // o3: count ERROR lines.
    const errors = run("grep -c ERROR /var/log/app.log").stdout.trim();
    expect(check("o3", errors)).toBe(true);
    expect(check("o3", String(Number(errors) + 1))).toBe(false);
  });
});

test("different seeds give different answers", async () => {
  const a = await openLab(LAB, "seed-a");
  const b = await openLab(LAB, "seed-b");
  expect(a.answers.flag1).not.toBe(b.answers.flag1);
  expect(a.answers.flag2).not.toBe(b.answers.flag2);
});

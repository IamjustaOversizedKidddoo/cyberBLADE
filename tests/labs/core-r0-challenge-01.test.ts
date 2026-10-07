import { FLAG, openLab, SEEDS } from "./helpers";

const LAB = "core-r0-challenge-01";

describe.each(SEEDS)(`${LAB} with seed %s`, (seed) => {
  test("solvable using only the terminal", async () => {
    const { run, check, lab } = await openLab(LAB, seed);
    expect(lab.challenge).toEqual({ rank: 0, time_limit_minutes: 45, cooldown_minutes: 30 });

    // o1: who has the most failed SSH logins? Count per user seen in the failures.
    const failed = run('grep "Failed password" /var/log/auth.log').stdout.trim().split("\n");
    const users = new Set(failed.map((l) => l.match(/for (?:invalid user )?(\S+) from/)![1]));
    const counts = [...users].map((u) => [u, Number(run(`grep "Failed password" /var/log/auth.log | grep -c "for.* ${u} from"`).stdout)] as const);
    const top = counts.sort((a, b) => b[1] - a[1])[0][0];
    expect(check("o1", top)).toBe(true);
    expect(check("o1", top.toUpperCase())).toBe(true);

    // o2: the drop folder can't be listed, but the note names the file.
    expect(run("ls /srv/drop").stderr).toContain("Permission denied");
    const path = run("grep /srv/drop ~/notes.txt").stdout.match(/\/srv\/drop\/\S+\.txt/)![0];
    const flag = run(`cat ${path}`).stdout.match(FLAG)![0];
    expect(check("o2", flag)).toBe(true);

    // o3: IPs on the allow-list, ignoring comment lines.
    const ips = run('grep -vc "^#" /etc/firewall/allowlist.txt').stdout.trim();
    expect(check("o3", ips)).toBe(true);
  });
});

test.each(SEEDS)("auth.log only says 'invalid user' for accounts that don't exist (seed %s)", async (seed) => {
  const { run } = await openLab(LAB, seed);
  const accounts = new Set(run("cat /etc/passwd").stdout.split("\n").map((l) => l.split(":")[0]));
  const invalid = [...run('grep "invalid user" /var/log/auth.log').stdout.matchAll(/invalid user (\S+)/g)].map((m) => m[1]);
  expect(invalid.length).toBeGreaterThan(0);
  for (const name of invalid) expect(accounts.has(name)).toBe(false);
});

test("different seeds give different answers", async () => {
  const a = await openLab(LAB, "seed-a");
  const b = await openLab(LAB, "seed-b");
  expect(a.answers.flag).not.toBe(b.answers.flag);
});

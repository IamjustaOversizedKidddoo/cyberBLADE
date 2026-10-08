import { createShell } from "@/lib/lab-engine/terminal/shell";
import { procWorld } from "../fixture-processes";

const run = (line: string) => createShell(procWorld()).exec(line);

test("matches process names; -l adds the name, -a the full command", () => {
  expect(run("pgrep cron")).toEqual({ stdout: "640\n", stderr: "", code: 0 });
  expect(run("pgrep -l sshd").stdout).toBe("812 sshd\n2190 sshd\n2200 sshd\n");
  expect(run("pgrep -a python").stdout).toBe("1500 python3 -m http.server 8000\n");
});

test("-u filters by user, -f matches the whole command line", () => {
  expect(run("pgrep -u op sleep").stdout).toBe("2150\n");
  expect(run("pgrep -u root sleep")).toEqual({ stdout: "", stderr: "", code: 1 });
  expect(run("pgrep -f http.server").stdout).toBe("1500\n");
  expect(run("pgrep http.server")).toMatchObject({ code: 1 });
});

test("no match is exit 1, no pattern is a usage error", () => {
  expect(run("pgrep nosuch")).toEqual({ stdout: "", stderr: "", code: 1 });
  expect(run("pgrep")).toEqual({ stdout: "", stderr: "pgrep: no matching criteria specified\nTry `pgrep --help' for more information.\n", code: 2 });
});

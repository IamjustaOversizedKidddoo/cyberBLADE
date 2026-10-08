import { createShell } from "@/lib/lab-engine/terminal/shell";
import { procWorld } from "../fixture-processes";

const sh = (user = "op") => createShell(procWorld(user));

test("killing your own process removes it from ps and /proc at once", () => {
  const s = sh();
  expect(s.exec("kill 2150")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(s.exec("ps aux").stdout).not.toContain("sleep 600");
  expect(s.exec("ls /proc/2150").stderr).toBe("ls: cannot access '/proc/2150': No such file or directory\n");
});

test("signals by number or name", () => {
  for (const sig of ["-9", "-KILL", "-SIGKILL", "-15", "-TERM", "-s KILL"]) {
    expect(sh().exec(`kill ${sig} 2150`).code).toBe(0);
  }
  expect(sh().exec("kill -QUX 2150")).toEqual({ stdout: "", stderr: "bash: kill: QUX: invalid signal specification\n", code: 1 });
});

test("bash's own messages for other people's processes, missing PIDs and bad arguments", () => {
  const s = sh();
  expect(s.exec("kill 1")).toEqual({ stdout: "", stderr: "bash: kill: (1) - Operation not permitted\n", code: 1 });
  expect(s.exec("kill 1500")).toEqual({ stdout: "", stderr: "bash: kill: (1500) - Operation not permitted\n", code: 1 });
  expect(s.exec("ps aux").stdout).toContain("python3 -m http.server");
  expect(s.exec("kill 99999")).toEqual({ stdout: "", stderr: "bash: kill: (99999) - No such process\n", code: 1 });
  expect(s.exec("kill abc")).toEqual({ stdout: "", stderr: "bash: kill: abc: arguments must be process or job IDs\n", code: 1 });
  expect(s.exec("kill")).toEqual({
    stdout: "",
    stderr: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n",
    code: 2,
  });
});

test("your own shell ignores TERM and the lab refuses KILL; init ignores root", () => {
  const s = sh();
  expect(s.exec("kill 2201")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(s.exec("kill -9 2201")).toEqual({ stdout: "", stderr: "kill: this lab keeps your shell running\n", code: 1 });
  expect(s.exec("ps").stdout).toContain(" bash\n");
  const root = sh("root");
  expect(root.exec("kill -9 1")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(root.exec("ps aux").stdout).toContain("/sbin/init splash");
});

test("root may kill anything; children of a killed process are adopted by PID 1", () => {
  const root = sh("root");
  root.exec("kill 2200");
  expect(root.exec("ps -ef").stdout).toContain("op          2150       1  0 08:55 pts/0    00:00:00 sleep 600");
});

test("kill -l lists signals like bash", () => {
  expect(sh().exec("kill -l").stdout).toBe(
    " 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 4) SIGILL\t 5) SIGTRAP\n" +
      " 6) SIGABRT\t 7) SIGBUS\t 8) SIGFPE\t 9) SIGKILL\t10) SIGUSR1\n" +
      "11) SIGSEGV\t12) SIGUSR2\t13) SIGPIPE\t14) SIGALRM\t15) SIGTERM\n",
  );
});

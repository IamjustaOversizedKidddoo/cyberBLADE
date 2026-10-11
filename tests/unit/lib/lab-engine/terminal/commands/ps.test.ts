import { createShell } from "@/lib/lab-engine/terminal/shell";
import { procWorld } from "../fixture-processes";

const sh = (user = "op") => createShell(procWorld(user));

test("ps aux: procps-ng columns, long user names cut with +, the ps itself listed", () => {
  expect(sh().exec("ps aux").stdout).toBe(
    [
      "USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND",
      "root           1  0.0  0.3 167832 13136 ?        Ss   08:55   0:02 /sbin/init splash",
      "root           2  0.0  0.0      0     0 ?        S    08:55   0:00 [kthreadd]",
      "root          31  0.0  0.0      0     0 ?        I    08:55   0:00 [kworker/0:1-events]",
      "root         312  0.0  0.4  50460 15872 ?        Ss   08:55   0:00 /usr/lib/systemd/systemd-journald",
      "systemd+     455  0.0  0.3  21592 12928 ?        Ss   08:55   0:00 /usr/lib/systemd/systemd-resolved",
      "root         640  0.0  0.1   6824  2688 ?        Ss   08:55   0:00 /usr/sbin/cron -f -P",
      "root         812  0.0  0.2  12016  7936 ?        Ss   08:55   0:00 sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups",
      "root        1500  0.0  0.4  31236 19456 ?        S    08:55   0:00 python3 -m http.server 8000",
      "op          2150  0.0  0.0   5680  1920 pts/0    S    08:55   0:00 sleep 600",
      "root        2190  0.0  0.2  14720  9216 ?        Ss   08:55   0:00 sshd: op [priv]",
      "op          2200  0.0  0.1  14980  6400 ?        S    08:55   0:00 sshd: op@pts/0",
      "op          2201  0.0  0.1   8784  5376 pts/0    Ss   09:58   0:00 -bash",
      "op          2202  0.0  0.1  11316  4480 pts/0    R+   10:00   0:00 ps aux",
      "",
    ].join("\n"),
  );
});

test("ps -ef: UID PID PPID C STIME TTY TIME CMD", () => {
  const out = sh().exec("ps -ef").stdout.split("\n");
  expect(out[0]).toBe("UID          PID    PPID  C STIME TTY          TIME CMD");
  expect(out[1]).toBe("root           1       0  0 08:55 ?        00:00:02 /sbin/init splash");
  expect(out).toContain("op          2150    2200  0 08:55 pts/0    00:00:00 sleep 600");
  expect(out).toContain("op          2202    2201  0 10:00 pts/0    00:00:00 ps -ef");
});

test("plain ps: only your terminal's processes", () => {
  expect(sh().exec("ps").stdout).toBe("    PID TTY          TIME CMD\n   2150 pts/0    00:00:00 sleep\n   2201 pts/0    00:00:00 bash\n   2202 pts/0    00:00:00 ps\n");
});

test("each command gets the next PID; unknown options are refused", () => {
  const s = sh();
  s.exec("ls");
  expect(s.exec("ps").stdout).toContain("   2203 pts/0    00:00:00 ps\n");
  expect(s.exec("ps -Z")).toEqual({ stdout: "", stderr: "ps: this lab supports ps, ps aux and ps -ef\n", code: 1 });
});

test("a world without processes still has your shell", () => {
  const w = procWorld();
  delete w.processes;
  expect(createShell(w).exec("ps").stdout).toBe("    PID TTY          TIME CMD\n   2201 pts/0    00:00:00 bash\n   2202 pts/0    00:00:00 ps\n");
});

test("ps accepts -aux alias, -e/-A, and split -e -f flags", () => {
  const s = sh();
  expect(s.exec("ps -aux").stdout).toContain("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND");
  expect(s.exec("ps -e -f").stdout).toContain("UID          PID    PPID  C STIME TTY          TIME CMD");
  expect(s.exec("ps -e").stdout).toContain("    PID TTY          TIME CMD\n");
  expect(s.exec("ps -A").stdout).toContain("    PID TTY          TIME CMD\n");
});


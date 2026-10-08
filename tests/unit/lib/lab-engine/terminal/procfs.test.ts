import { createShell } from "@/lib/lab-engine/terminal/shell";
import { procWorld } from "./fixture-processes";

const sh = (user = "op") => createShell(procWorld(user));

test("/proc lists one folder per process and the system files", () => {
  const names = sh().exec("ls /proc").stdout.split(/\s+/).filter(Boolean);
  expect(names).toEqual(expect.arrayContaining(["1", "455", "2150", "2201", "cpuinfo", "meminfo", "uptime", "version"]));
});

test("system files come from sysinfo", () => {
  const s = sh();
  expect(s.exec("cat /proc/version").stdout).toMatch(/^Linux version 6\.8\.0-45-generic \(buildd@/);
  expect(s.exec("grep -c processor /proc/cpuinfo").stdout).toBe("2\n");
  expect(s.exec("head -1 /proc/meminfo").stdout).toBe("MemTotal:        4015280 kB\n");
});

test("cmdline is NUL-separated; tr makes it readable", () => {
  const s = sh();
  expect(s.exec("cat /proc/1500/cmdline").stdout).toBe("python3\0-m\0http.server\08000\0");
  expect(s.exec("cat /proc/1500/cmdline | tr '\\0' ' '").stdout).toBe("python3 -m http.server 8000 ");
  expect(s.exec("cat /proc/2/cmdline").stdout).toBe("");
  expect(s.exec("cat /proc/1500/comm").stdout).toBe("python3\n");
});

test("status shows name, state, PIDs and user ids", () => {
  expect(sh().exec("cat /proc/2150/status").stdout).toBe(
    "Name:\tsleep\nUmask:\t0022\nState:\tS (sleeping)\nTgid:\t2150\nNgid:\t0\nPid:\t2150\nPPid:\t2200\nTracerPid:\t0\nUid:\t1000\t1000\t1000\t1000\nGid:\t1000\t1000\t1000\t1000\n",
  );
});

test("environ is private to the process owner", () => {
  const s = sh();
  expect(s.exec("cat /proc/2150/environ").stdout).toBe("HOME=/home/op\0LANG=C.UTF-8\0");
  expect(s.exec("cat /proc/1500/environ").stderr).toBe("cat: /proc/1500/environ: Permission denied\n");
});

test("/proc is read-only", () => {
  expect(sh("root").exec("echo x > /proc/version").stderr).toBe("bash: /proc/version: Permission denied\n");
});

import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { Service } from "@/lib/lab-engine/terminal/services";
import { procWorld } from "../fixture-processes";

const SERVICES: Service[] = [
  {
    name: "ssh",
    description: "OpenBSD Secure Shell server",
    unitPath: "/usr/lib/systemd/system/ssh.service",
    enabled: "enabled",
    active: "active",
    sub: "running",
    since: "Wed 2026-10-07 08:55:04 IST",
    mainPid: 812,
  },
  {
    name: "apache2",
    description: "The Apache HTTP Server",
    unitPath: "/usr/lib/systemd/system/apache2.service",
    enabled: "disabled",
    active: "inactive",
    sub: "dead",
  },
  {
    name: "backup",
    description: "Nightly Backup Job",
    unitPath: "/usr/lib/systemd/system/backup.service",
    enabled: "enabled",
    active: "failed",
    sub: "failed",
    since: "Wed 2026-10-07 09:00:00 IST",
    mainPid: 1200,
    result: "exit-code",
  },
];

const sh = () => {
  const w = procWorld();
  w.services = SERVICES;
  return createShell(w);
};

test("systemctl status for running, inactive, failed, and unknown services", () => {
  const s = sh();

  const sshOut = s.exec("systemctl status ssh");
  expect(sshOut.code).toBe(0);
  expect(sshOut.stdout).toContain("● ssh.service - OpenBSD Secure Shell server");
  expect(sshOut.stdout).toContain("Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)");
  expect(sshOut.stdout).toContain("Active: active (running) since Wed 2026-10-07 08:55:04 IST; 1h 4min ago");
  expect(sshOut.stdout).toContain("Main PID: 812 (sshd)");
  expect(sshOut.stdout).toContain("CGroup: /system.slice/ssh.service");
  expect(sshOut.stdout).toContain('└─812 "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"');

  const apacheOut = s.exec("systemctl status apache2.service");
  expect(apacheOut.code).toBe(3);
  expect(apacheOut.stdout).toContain("○ apache2.service - The Apache HTTP Server");
  expect(apacheOut.stdout).toContain("Active: inactive (dead)");

  const backupOut = s.exec("systemctl status backup");
  expect(backupOut.code).toBe(3);
  expect(backupOut.stdout).toContain("× backup.service - Nightly Backup Job");
  expect(backupOut.stdout).toContain("Active: failed (Result: exit-code)");

  const unknownOut = s.exec("systemctl status nosuch");
  expect(unknownOut.code).toBe(4);
  expect(unknownOut.stderr).toBe("Unit nosuch.service could not be found.\n");
});

test("systemctl list-units with service filter and state filters", () => {
  const s = sh();

  const all = s.exec("systemctl list-units --type=service");
  expect(all.code).toBe(0);
  expect(all.stdout).toContain("UNIT");
  expect(all.stdout).toContain("ssh.service");
  expect(all.stdout).toContain("● backup.service");
  expect(all.stdout).toContain("LOAD   = Reflects whether the unit definition was properly loaded.");
  expect(all.stdout).toContain("Pass --all to see loaded but inactive units, too.");

  const failedOnly = s.exec("systemctl list-units --type=service --state=failed");
  expect(failedOnly.code).toBe(0);
  expect(failedOnly.stdout).toContain("backup.service");
  expect(failedOnly.stdout).not.toContain("ssh.service");

  const runningOnly = s.exec("systemctl list-units --type=service --state=running");
  expect(runningOnly.code).toBe(0);
  expect(runningOnly.stdout).toContain("ssh.service");
  expect(runningOnly.stdout).not.toContain("backup.service");
});

test("systemctl is-active and is-enabled", () => {
  const s = sh();

  expect(s.exec("systemctl is-active ssh")).toEqual({ stdout: "active\n", stderr: "", code: 0 });
  expect(s.exec("systemctl is-active apache2")).toEqual({ stdout: "inactive\n", stderr: "", code: 3 });
  expect(s.exec("systemctl is-active backup")).toEqual({ stdout: "failed\n", stderr: "", code: 3 });
  expect(s.exec("systemctl is-active nosuch")).toEqual({ stdout: "unknown\n", stderr: "", code: 3 });

  expect(s.exec("systemctl is-enabled ssh")).toEqual({ stdout: "enabled\n", stderr: "", code: 0 });
  expect(s.exec("systemctl is-enabled apache2")).toEqual({ stdout: "disabled\n", stderr: "", code: 3 });
});

test("systemctl refuses unsupported mutating verbs", () => {
  const s = sh();
  expect(s.exec("systemctl restart ssh")).toEqual({
    stdout: "",
    stderr: "systemctl: this lab can only inspect services (status, list-units, is-active, is-enabled)\n",
    code: 1,
  });
});

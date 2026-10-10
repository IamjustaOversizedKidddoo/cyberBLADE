import { createShell } from "@/lib/lab-engine/terminal/shell";
import { demoWorld } from "@/lib/lab-engine/terminal/demo-world";

test("demoWorld has standard Ubuntu SUID binaries, processes, services, and sudoers rule", () => {
  const s = createShell(demoWorld());

  const suid = s.exec("find / -perm -4000 2>/dev/null");
  expect(suid.code).toBe(1);
  const suidPaths = suid.stdout.trim().split("\n").sort();
  expect(suidPaths).toEqual([
    "/usr/bin/chfn",
    "/usr/bin/chsh",
    "/usr/bin/gpasswd",
    "/usr/bin/mount",
    "/usr/bin/newgrp",
    "/usr/bin/passwd",
    "/usr/bin/su",
    "/usr/bin/sudo",
    "/usr/bin/umount",
  ]);

  const ps = s.exec("ps aux | grep sshd");
  expect(ps.stdout).toContain("sshd");

  const failedUnits = s.exec("systemctl list-units --type=service --state=failed");
  expect(failedUnits.stdout).toContain("backup.service");
  expect(failedUnits.stdout).not.toContain("ssh.service");

  const sudoL = s.exec("sudo -l");
  expect(sudoL.code).toBe(0);
  expect(sudoL.stdout).toContain("(root) NOPASSWD: /usr/bin/systemctl status *");
});

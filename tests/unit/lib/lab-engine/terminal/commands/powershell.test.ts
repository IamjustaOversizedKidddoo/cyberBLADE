import { describe, expect, it } from "vitest";
import { dir, file } from "@/lib/lab-engine/terminal/build";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";

describe("PowerShell cmdlets in lab shell", () => {
  const world: World = {
    hostname: "WIN-SEC-01",
    user: "operator",
    home: "/Users/operator",
    root: dir({
      Users: dir({
        operator: dir({
          "log.txt": file("Error: failed to connect to database\nInfo: retry in 5s\n"),
        }),
      }),
    }),
    registry: {
      "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run": {
        SecurityHealth: "C:\\Windows\\system32\\SecurityHealthSystray.exe",
        MalwarePersist: "C:\\Users\\public\\beacon.exe",
      },
    },
    eventLogs: [
      {
        logName: "Security",
        id: 4624,
        timeCreated: "10/07/2026 09:00:00 AM",
        message: "An account was successfully logged on.",
      },
      {
        logName: "Security",
        id: 4625,
        timeCreated: "10/07/2026 09:01:15 AM",
        message: "An account failed to log on.",
      },
    ],
    services: [
      { name: "Spooler", description: "Print Spooler", unitPath: "C:\\Windows\\System32\\spoolsv.exe", active: "active", enabled: "enabled", sub: "running" },
      { name: "W32Time", description: "Windows Time", unitPath: "C:\\Windows\\System32\\w32time.dll", active: "inactive", enabled: "disabled", sub: "dead" },
    ],
    processes: [
      {
        pid: 1040,
        ppid: 1,
        user: "SYSTEM",
        argv: ["svchost.exe", "-k", "netsvcs"],
        state: "S",
        stat: "S",
        tty: "?",
        start: "08:50",
        cpuTime: "0:01",
        cpu: 0,
        mem: 0.5,
        vsz: 24000,
        rss: 12000,
      },
    ],
    scheduledTasks: [
      {
        taskName: "WeeklyBackup",
        taskPath: "\\",
        state: "Ready",
        action: "C:\\Windows\\System32\\backup.exe",
      },
    ],
  };

  it("Get-ItemProperty (and gp) inspects registry keys", () => {
    const sh = createShell(world);
    const r1 = sh.exec("Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run");
    expect(r1.code).toBe(0);
    expect(r1.stdout).toContain("MalwarePersist");
    expect(r1.stdout).toContain("C:\\Users\\public\\beacon.exe");

    const r2 = sh.exec("gp hklm:/software/microsoft/windows/currentversion/run -Name MalwarePersist");
    expect(r2.code).toBe(0);
    expect(r2.stdout.trim()).toBe("C:\\Users\\public\\beacon.exe");

    const missing = sh.exec("Get-ItemProperty HKLM:\\SOFTWARE\\DoesNotExist");
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("Cannot find path");
  });

  it("Get-WinEvent retrieves and filters security events", () => {
    const sh = createShell(world);
    const r = sh.exec("Get-WinEvent -LogName Security");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("4624");
    expect(r.stdout).toContain("4625");

    const filtered = sh.exec("Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625}");
    expect(filtered.code).toBe(0);
    expect(filtered.stdout).toContain("4625");
    expect(filtered.stdout).not.toContain("4624");
  });

  it("Select-String (and sls) filters pipelines and files", () => {
    const sh = createShell(world);
    const p1 = sh.exec("Get-WinEvent -LogName Security | Select-String 4625");
    expect(p1.code).toBe(0);
    expect(p1.stdout).toContain("4625");
    expect(p1.stdout).not.toContain("4624");

    const p2 = sh.exec("sls -Path log.txt -Pattern error");
    expect(p2.code).toBe(0);
    expect(p2.stdout).toContain("failed to connect");
  });

  it("Get-Service and Get-Process inspect system state", () => {
    const sh = createShell(world);
    const svc = sh.exec("Get-Service");
    expect(svc.code).toBe(0);
    expect(svc.stdout).toContain("Spooler");
    expect(svc.stdout).toContain("Running");

    const svcFilter = sh.exec("gsv Spooler");
    expect(svcFilter.code).toBe(0);
    expect(svcFilter.stdout).toContain("Print Spooler");

    const proc = sh.exec("Get-Process -Name svchost*");
    expect(proc.code).toBe(0);
    expect(proc.stdout).toContain("svchost.exe");
  });

  it("Get-ScheduledTask lists scheduled tasks", () => {
    const sh = createShell(world);
    const r = sh.exec("Get-ScheduledTask");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("WeeklyBackup");
    expect(r.stdout).toContain("Ready");
  });

  it("whoami supports /priv and /groups on Windows", () => {
    const sh = createShell(world);
    const plain = sh.exec("whoami");
    expect(plain.stdout.trim()).toBe("operator");

    const priv = sh.exec("whoami /priv");
    expect(priv.stdout).toContain("PRIVILEGES INFORMATION");
    expect(priv.stdout).toContain("SeChangeNotifyPrivilege");

    const groups = sh.exec("whoami /groups");
    expect(groups.stdout).toContain("GROUP INFORMATION");
    expect(groups.stdout).toContain("BUILTIN\\Users");
  });
});

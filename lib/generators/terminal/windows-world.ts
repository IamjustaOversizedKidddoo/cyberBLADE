import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { Proc } from "@/lib/lab-engine/terminal/processes";
import type { Service } from "@/lib/lab-engine/terminal/services";
import type { DirNode, Node, World } from "@/lib/lab-engine/terminal/types";
import type { WinEvent, WinTask, RegistryHive } from "@/lib/lab-engine/terminal/windows/types";
import type { Rng } from "../rng";

export const WIN_HOST_PREFIXES = ["CORP-WS", "WIN-SEC", "FIN-DESK", "OPS-ENDPT", "HR-CLIENT"] as const;

export function pickWinHostname(rng: Rng): string {
  const prefix = rng.pick(WIN_HOST_PREFIXES);
  const num = String(rng.int(1, 99)).padStart(2, "0");
  return `${prefix}-${num}`;
}

const exe = () => file("MZ\x90\x00 (simulated PE binary — not runnable in this lab)\n", { mode: 0o755 });

export type WindowsWorldOptions = {
  hostname?: string;
  user?: string;
  home?: Record<string, Node>;
  extraDirs?: Record<string, Node>;
  registry?: RegistryHive;
  services?: Service[];
  processes?: Proc[];
  eventLogs?: WinEvent[];
  scheduledTasks?: WinTask[];
  extraEnv?: Record<string, string>;
};

export function windowsBaseWorld(opts: WindowsWorldOptions = {}): World {
  const user = opts.user ?? "operator";
  const hostname = opts.hostname ?? "CORP-WS-01";
  const home = `/Users/${user}`;

  const defaultRoot: Record<string, Node> = {
    Windows: dir({
      System32: dir({
        "cmd.exe": exe(),
        "powershell.exe": exe(),
        "svchost.exe": exe(),
        "lsass.exe": exe(),
        "services.exe": exe(),
        "whoami.exe": exe(),
        drivers: dir({
          etc: dir({
            hosts: file("127.0.0.1       localhost\n::1             localhost\n"),
          }),
        }),
      }),
      Temp: dir({}),
    }),
    Users: dir({
      [user]: dir({
        Desktop: dir({}),
        Documents: dir({}),
        Downloads: dir({}),
        AppData: dir({
          Local: dir({
            Temp: dir({}),
          }),
          Roaming: dir({}),
        }),
        ...(opts.home ?? {}),
      }),
      Administrator: dir({
        Desktop: dir({}),
      }),
      Public: dir({
        Documents: dir({}),
        Downloads: dir({}),
      }),
    }),
    "Program Files": dir({
      "Common Files": dir({}),
      "Windows Defender": dir({
        "MsMpEng.exe": exe(),
      }),
    }),
    ProgramData: dir({}),
    ...(opts.extraDirs ?? {}),
  };

  const defaultRegistry: RegistryHive = {
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run": {
      SecurityHealth: "C:\\Windows\\System32\\SecurityHealthSystray.exe",
      OneDriveSetup: "C:\\Windows\\System32\\OneDriveSetup.exe /thfirstsetup",
    },
    "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion": {
      ProductName: "Windows 11 Enterprise",
      CurrentVersion: "6.3",
      CurrentBuild: "22631",
      ReleaseId: "23H2",
    },
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run": {
      OneDrive: "C:\\Users\\operator\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe /background",
    },
    ...(opts.registry ?? {}),
  };

  const defaultServices: Service[] = [
    { name: "Spooler", description: "Print Spooler", unitPath: "C:\\Windows\\System32\\spoolsv.exe", active: "active", enabled: "enabled", sub: "running" },
    { name: "W32Time", description: "Windows Time", unitPath: "C:\\Windows\\System32\\w32time.dll", active: "active", enabled: "enabled", sub: "running" },
    { name: "WinDefend", description: "Microsoft Defender Antivirus Service", unitPath: "C:\\Program Files\\Windows Defender\\MsMpEng.exe", active: "active", enabled: "enabled", sub: "running" },
    { name: "LanmanServer", description: "Server (SMB File Sharing)", unitPath: "C:\\Windows\\System32\\srvsvc.dll", active: "active", enabled: "enabled", sub: "running" },
    { name: "LanmanWorkstation", description: "Workstation (SMB Client)", unitPath: "C:\\Windows\\System32\\wkssvc.dll", active: "active", enabled: "enabled", sub: "running" },
    { name: "Dnscache", description: "DNS Client Cache Service", unitPath: "C:\\Windows\\System32\\dnsapi.dll", active: "active", enabled: "enabled", sub: "running" },
    { name: "EventLog", description: "Windows Event Log", unitPath: "C:\\Windows\\System32\\wevtsvc.dll", active: "active", enabled: "enabled", sub: "running" },
    { name: "MpsSvc", description: "Windows Defender Firewall", unitPath: "C:\\Windows\\System32\\mpssvc.dll", active: "active", enabled: "enabled", sub: "running" },
    ...(opts.services ?? []),
  ];

  const defaultProcesses: Proc[] = [
    {
      pid: 4,
      ppid: 0,
      user: "SYSTEM",
      argv: ["System"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:12",
      cpu: 0.1,
      mem: 0.1,
      vsz: 1024,
      rss: 512,
    },
    {
      pid: 360,
      ppid: 4,
      user: "SYSTEM",
      argv: ["smss.exe"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:01",
      cpu: 0,
      mem: 0.2,
      vsz: 4096,
      rss: 2048,
    },
    {
      pid: 480,
      ppid: 360,
      user: "SYSTEM",
      argv: ["csrss.exe"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:05",
      cpu: 0.1,
      mem: 0.3,
      vsz: 8192,
      rss: 4096,
    },
    {
      pid: 620,
      ppid: 480,
      user: "SYSTEM",
      argv: ["services.exe"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:04",
      cpu: 0.1,
      mem: 0.4,
      vsz: 12288,
      rss: 6144,
    },
    {
      pid: 680,
      ppid: 480,
      user: "SYSTEM",
      argv: ["lsass.exe"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:08",
      cpu: 0.2,
      mem: 0.8,
      vsz: 24576,
      rss: 14336,
    },
    {
      pid: 940,
      ppid: 620,
      user: "NETWORK SERVICE",
      argv: ["svchost.exe", "-k", "DnsCache"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:02",
      cpu: 0,
      mem: 0.5,
      vsz: 16384,
      rss: 8192,
    },
    {
      pid: 1020,
      ppid: 620,
      user: "SYSTEM",
      argv: ["svchost.exe", "-k", "netsvcs"],
      state: "S",
      stat: "Ss",
      tty: "?",
      start: "08:00",
      cpuTime: "0:03",
      cpu: 0.1,
      mem: 0.6,
      vsz: 20480,
      rss: 10240,
    },
    ...(opts.processes ?? []),
  ];

  const defaultEvents: WinEvent[] = [
    {
      logName: "System",
      id: 7036,
      timeCreated: "10/07/2026 08:00:10 AM",
      message: "The Windows Event Log service entered the running state.",
    },
    {
      logName: "System",
      id: 7036,
      timeCreated: "10/07/2026 08:00:15 AM",
      message: "The Microsoft Defender Antivirus Service service entered the running state.",
    },
    {
      logName: "Security",
      id: 4624,
      timeCreated: "10/07/2026 08:15:00 AM",
      message: `An account was successfully logged on. TargetUserName: ${user}, LogonType: 2 (Interactive).`,
    },
    ...(opts.eventLogs ?? []),
  ];

  const defaultTasks: WinTask[] = [
    {
      taskName: "\\Microsoft\\Windows\\Defrag\\ScheduledDefrag",
      taskPath: "\\Microsoft\\Windows\\Defrag\\",
      state: "Ready",
      action: "defrag.exe -c -h -k -$",
    },
    {
      taskName: "\\Microsoft\\Windows\\Windows Defender\\Windows Defender Scheduled Scan",
      taskPath: "\\Microsoft\\Windows\\Windows Defender\\",
      state: "Ready",
      action: "C:\\Program Files\\Windows Defender\\MpCmdRun.exe Scan -ScheduleJob",
    },
    ...(opts.scheduledTasks ?? []),
  ];

  return {
    hostname,
    user,
    home,
    root: dir(defaultRoot as Record<string, DirNode | Node>),
    registry: defaultRegistry,
    services: defaultServices,
    processes: defaultProcesses,
    eventLogs: defaultEvents,
    scheduledTasks: defaultTasks,
    env: {
      OS: "Windows_NT",
      PROCESSOR_ARCHITECTURE: "AMD64",
      PSModulePath: "C:\\Program Files\\WindowsPowerShell\\Modules;C:\\Windows\\system32\\WindowsPowerShell\\v1.0\\Modules",
      USERDOMAIN: hostname,
      USERNAME: user,
      ...(opts.extraEnv ?? {}),
    },
  };
}

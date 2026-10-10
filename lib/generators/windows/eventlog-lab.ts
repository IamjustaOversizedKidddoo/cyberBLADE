import type { WinEvent } from "@/lib/lab-engine/terminal/windows/types";
import type { Generator } from "../index";
import { pickWinHostname, windowsBaseWorld } from "../terminal/windows-world";

const TARGET_USERS = ["svc_backup", "admin_local", "it_helpdesk", "sql_agent", "finance_lead"];
const ATTACKER_IPS = ["192.168.1.105", "10.0.5.88", "172.16.4.22", "192.168.50.14", "10.10.8.45"];
const ROGUE_SERVICES = [
  { name: "WinDefenderUpdater", file: "C:\\Windows\\Temp\\updater.exe" },
  { name: "NetHealthSvc", file: "C:\\ProgramData\\nethealth.exe" },
  { name: "ShadowCopyAgent", file: "C:\\Users\\Public\\shadow.exe" },
  { name: "PicoTaskMonitor", file: "C:\\ProgramData\\temp\\picotask.exe" },
];

export const eventlogLab: Generator = (rng) => {
  const hostname = pickWinHostname(rng);
  const targetUser = rng.pick(TARGET_USERS);
  const attackerIp = rng.pick(ATTACKER_IPS);
  const rogueService = rng.pick(ROGUE_SERVICES);

  const events: WinEvent[] = [
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
      message: "An account was successfully logged on. TargetUserName: SYSTEM, LogonType: 0.",
    },
    // Failed logon sequence (brute force)
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:12:01 AM",
      message: `An account failed to log on. TargetUserName: ${targetUser}, WorkstationName: ATTACK-BOX, IpAddress: ${attackerIp}, Status: 0xC000006D, SubStatus: 0xC000006A.`,
    },
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:12:05 AM",
      message: `An account failed to log on. TargetUserName: ${targetUser}, WorkstationName: ATTACK-BOX, IpAddress: ${attackerIp}, Status: 0xC000006D, SubStatus: 0xC000006A.`,
    },
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:12:09 AM",
      message: `An account failed to log on. TargetUserName: ${targetUser}, WorkstationName: ATTACK-BOX, IpAddress: ${attackerIp}, Status: 0xC000006D, SubStatus: 0xC000006A.`,
    },
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:12:14 AM",
      message: `An account failed to log on. TargetUserName: ${targetUser}, WorkstationName: ATTACK-BOX, IpAddress: ${attackerIp}, Status: 0xC000006D, SubStatus: 0xC000006A.`,
    },
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:12:20 AM",
      message: `An account failed to log on. TargetUserName: ${targetUser}, WorkstationName: ATTACK-BOX, IpAddress: ${attackerIp}, Status: 0xC000006D, SubStatus: 0xC000006A.`,
    },
    // Compromised logon
    {
      logName: "Security",
      id: 4624,
      timeCreated: "10/07/2026 09:12:35 AM",
      message: `An account was successfully logged on. TargetUserName: ${targetUser}, WorkstationName: ATTACK-BOX, IpAddress: ${attackerIp}, LogonType: 3 (Network).`,
    },
    // Service installation
    {
      logName: "System",
      id: 7045,
      timeCreated: "10/07/2026 09:14:02 AM",
      message: `A service was installed in the system. ServiceName: ${rogueService.name}, ServiceFileName: ${rogueService.file}, ServiceType: user mode service, ServiceStartType: auto start, AccountName: LocalSystem.`,
    },
  ];

  const world = windowsBaseWorld({
    hostname,
    user: "operator",
    eventLogs: events,
  });

  return {
    env: { kind: "terminal", world },
    answers: {
      failedLogonEventId: "4625",
      targetUser,
      attackerIp,
      serviceName: rogueService.name,
    },
  };
};

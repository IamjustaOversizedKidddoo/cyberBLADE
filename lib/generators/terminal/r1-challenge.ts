import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { WinEvent } from "@/lib/lab-engine/terminal/windows/types";
import { formatFlag } from "../flag";
import type { Generator } from "../index";
import { pickWinHostname, windowsBaseWorld } from "./windows-world";

const BEACON_DOMAINS = [
  "c2-relay-89.malicious.net",
  "sync-agent-04.darkdns.org",
  "telemetry-exfil-22.net",
  "api-cloud-gate.cc",
  "win-update-probe.info",
];

const BEACON_IPS = [
  "198.51.100.42",
  "203.0.113.88",
  "192.0.2.144",
  "198.51.100.115",
  "203.0.113.204",
];

const ROGUE_RUN_NAMES = [
  "WinSecuritySync",
  "EdgeHealthMonitor",
  "DefenderUpdateAgent",
  "JavaCloudHelper",
  "HostTelemetryProbe",
];

const COMPROMISED_USERS = [
  "svc_deploy",
  "finance_lead",
  "sec_analyst",
  "admin_local",
  "ops_engineer",
];

export const r1Challenge: Generator = (rng) => {
  const hostname = pickWinHostname(rng);
  const beaconDomain = rng.pick(BEACON_DOMAINS);
  const beaconIp = rng.pick(BEACON_IPS);
  const rogueRunName = rng.pick(ROGUE_RUN_NAMES);
  const compromisedUser = rng.pick(COMPROMISED_USERS);
  const challengeFlag = formatFlag(rng.hex(12));

  const triageLog =
    "=== INCIDENT TRIAGE PACKET CAPTURE REPORT ===\n" +
    "Timestamp            Proto  Source IP       Destination IP    Port  Info\n" +
    `10/07/2026 09:10:02  DNS    10.0.2.15       10.0.2.2          53    Standard query 0x1a4f A ${beaconDomain}\n` +
    `10/07/2026 09:10:02  DNS    10.0.2.2        10.0.2.15         53    Standard response 0x1a4f A ${beaconIp}\n` +
    `10/07/2026 09:10:05  TCP    10.0.2.15:49152 ${beaconIp}:443   443   [SYN] Seq=0 Win=64240 Len=0\n` +
    `10/07/2026 09:10:05  TLS    10.0.2.15:49152 ${beaconIp}:443   443   Client Hello (SNI: ${beaconDomain})\n` +
    `10/07/2026 09:10:08  TLS    10.0.2.15:49152 ${beaconIp}:443   443   Encrypted Handshake Message (Beacon Active)\n` +
    "=============================================\n";

  const instructions =
    "INCIDENT OPERATOR INSTRUCTIONS:\n" +
    "1. Review the network triage capture log in ~/Triage/incident-report.txt.\n" +
    "2. Inspect the Registry Run key for unauthorized autostart persistence.\n" +
    "3. Investigate the Windows Security event log for authentication anomalies.\n" +
    "4. Extract the incident containment flag from HKLM:\\SOFTWARE\\CyberBlade\\Verification.\n";

  const events: WinEvent[] = [
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:08:12 AM",
      message: `An account failed to log on. TargetUserName: guest, WorkstationName: ATTACK, IpAddress: ${beaconIp}.`,
    },
    {
      logName: "Security",
      id: 4625,
      timeCreated: "10/07/2026 09:08:15 AM",
      message: `An account failed to log on. TargetUserName: root, WorkstationName: ATTACK, IpAddress: ${beaconIp}.`,
    },
    {
      logName: "Security",
      id: 4624,
      timeCreated: "10/07/2026 09:09:44 AM",
      message: `An account was successfully logged on. TargetUserName: ${compromisedUser}, WorkstationName: ATTACK, IpAddress: ${beaconIp}, LogonType: 3 (Network).`,
    },
    {
      logName: "System",
      id: 7045,
      timeCreated: "10/07/2026 09:11:00 AM",
      message: `A service was installed in the system. ServiceName: NetRelayHost, ServiceFileName: C:\\Users\\Public\\relay.exe.`,
    },
  ];

  const registry = {
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run": {
      SecurityHealth: "C:\\Windows\\System32\\SecurityHealthSystray.exe",
      OneDriveSetup: "C:\\Windows\\System32\\OneDriveSetup.exe /thfirstsetup",
      [rogueRunName]: "C:\\Users\\Public\\beacon.exe",
    },
    "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion": {
      ProductName: "Windows 11 Enterprise",
      CurrentVersion: "6.3",
      CurrentBuild: "22631",
      ReleaseId: "23H2",
    },
    "HKLM:\\SOFTWARE\\CyberBlade\\Verification": {
      IncidentId: "INC-2026-R1-GATE",
      ContainmentFlag: challengeFlag,
      Status: "VERIFIED",
    },
  };

  const world = windowsBaseWorld({
    hostname,
    user: "operator",
    registry,
    eventLogs: events,
    home: {
      Triage: dir({
        "incident-report.txt": file(triageLog),
      }),
      Desktop: dir({
        "instructions.txt": file(instructions),
      }),
    },
  });

  return {
    env: { kind: "terminal", world },
    answers: {
      beaconIp,
      beaconDomain,
      rogueRunName,
      compromisedUser,
      flag: challengeFlag,
    },
  };
};

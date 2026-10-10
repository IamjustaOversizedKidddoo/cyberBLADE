import type { LabEnv } from "@/lib/lab-engine/env";
import type { SiemEvent } from "@/lib/lab-engine/siem/types";
import type { Generator } from "@/lib/generators";

const ATTACKER_IPS = [
  "198.51.100.44",
  "203.0.113.89",
  "192.0.2.115",
  "185.220.101.42",
  "45.154.255.67",
  "91.240.118.172",
];

const TARGET_USERS = [
  "svc_backup",
  "deploy_bot",
  "sec_analyst",
  "db_operator",
  "infra_admin",
  "web_admin",
];

const BACKDOOR_SERVICES = [
  "systemd-telemetryd",
  "sysmon-updater",
  "net-beacon-svc",
  "cloud-sync-daemon",
  "log-forwarder-agent",
];

export const siemInvestigation: Generator = (rng) => {
  const attackerIp = rng.pick(ATTACKER_IPS);
  const targetUser = rng.pick(TARGET_USERS);
  const backdoorService = rng.pick(BACKDOOR_SERVICES);
  const failedAttempts = rng.int(4, 8);
  const flagToken = rng.hex(8);
  const flag = `FLAG{siem_ir_${flagToken}}`;

  const events: SiemEvent[] = [];
  let eventSeq = 100;
  const nextId = () => `evt-${++eventSeq}`;

  // 1. Noise / Background legitimate events
  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:12:04",
    severity: "INFO",
    eventId: "DNS_QUERY",
    source: "dnsmasq",
    sourceIp: "10.0.0.15",
    destIp: "10.0.0.2",
    action: "QUERY_RESOLVE",
    message: "Standard query A api.internal.corp resolved to 10.0.0.50",
    raw: "Oct 10 08:12:04 gateway dnsmasq[912]: query[A] api.internal.corp from 10.0.0.15",
  });

  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:14:22",
    severity: "LOW",
    eventId: "4624",
    source: "Security.evtx",
    sourceIp: "10.0.0.20",
    destIp: "10.0.0.5",
    user: "alice_admin",
    action: "LOGON_SUCCESS",
    message: "An account was successfully logged on. LogonType: 2 (Interactive)",
    raw: "EventID 4624: An account was successfully logged on. Subject: DOMAIN\\alice_admin. Workstation: WS-012. IP: 10.0.0.20",
    metadata: { logon_type: 2, workstation: "WS-012" },
  });

  // 2. Reconnaissance scan from attacker IP
  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:20:11",
    severity: "MEDIUM",
    eventId: "PORT_SCAN",
    source: "firewall.log",
    sourceIp: attackerIp,
    destIp: "10.0.0.5",
    action: "SYN_FLOOD_DETECT",
    message: `Inbound TCP port probe detected from ${attackerIp} targeting ports 22, 80, 443, 3389, 8080`,
    raw: `Oct 10 08:20:11 edge-fw kernel: [SURICATA] ET SCAN Potential SSH/Web Scan from ${attackerIp} -> 10.0.0.5`,
    metadata: { proto: "TCP", probed_ports: "22,80,443,3389,8080" },
  });

  // 3. Brute Force Authentication Attempts
  for (let i = 1; i <= failedAttempts; i++) {
    const min = String(22 + Math.floor(i * 1.5)).padStart(2, "0");
    const sec = String((i * 13) % 60).padStart(2, "0");
    events.push({
      id: nextId(),
      timestamp: `2026-10-10 08:${min}:${sec}`,
      severity: "HIGH",
      eventId: "4625",
      source: "Security.evtx",
      sourceIp: attackerIp,
      destIp: "10.0.0.5",
      user: targetUser,
      action: "LOGON_FAILED",
      message: `An account failed to log on. TargetUserName: ${targetUser}. SubStatus: 0xC000006A (Wrong password). Attempt #${i}`,
      raw: `EventID 4625: An account failed to log on. Target: ${targetUser}. Source IP: ${attackerIp}. FailureReason: Unknown user name or bad password (0xC000006A).`,
      metadata: { attempt_num: i, sub_status: "0xC000006A" },
    });
  }

  // Legitimate NTP noise
  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:35:00",
    severity: "INFO",
    eventId: "NTP_SYNC",
    source: "chronyd",
    sourceIp: "10.0.0.5",
    destIp: "129.6.15.28",
    action: "TIME_SYNC",
    message: "System clock synchronized with time.nist.gov",
    raw: "Oct 10 08:35:00 srv chronyd[412]: Selected source 129.6.15.28 (time.nist.gov)",
  });

  // 4. Successful Compromise
  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:38:15",
    severity: "CRITICAL",
    eventId: "4624",
    source: "Security.evtx",
    sourceIp: attackerIp,
    destIp: "10.0.0.5",
    user: targetUser,
    action: "LOGON_SUCCESS",
    message: `CRITICAL ALERT: Successful remote authentication for ${targetUser} following ${failedAttempts} consecutive failed attempts from untrusted external IP ${attackerIp}!`,
    raw: `EventID 4624: Remote Interactive Logon Success for TargetUserName: ${targetUser} from IpAddress: ${attackerIp}. AuthenticationPackage: NTLM V2.`,
    metadata: { alert_rule: "SUSPICIOUS_BRUTE_FORCE_SUCCESS", logon_type: 10 },
  });

  // 5. Privilege Escalation & Persistence Installation
  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:41:09",
    severity: "CRITICAL",
    eventId: "7045",
    source: "System.evtx",
    sourceIp: attackerIp,
    destIp: "10.0.0.5",
    user: targetUser,
    action: "SERVICE_INSTALL",
    message: `A service was installed in the system. ServiceName: ${backdoorService}. ImagePath: C:\\ProgramData\\${backdoorService}.exe --c2-token=${flag}`,
    raw: `EventID 7045: Service installed: ${backdoorService}, ServiceType: user mode service, StartType: auto start, AccountName: LocalSystem, ImagePath: C:\\ProgramData\\${backdoorService}.exe --c2-token=${flag}`,
    metadata: { service_name: backdoorService, start_type: "auto", flag_token: flag },
  });

  // 6. Network Beacon
  events.push({
    id: nextId(),
    timestamp: "2026-10-10 08:43:55",
    severity: "CRITICAL",
    eventId: "C2_BEACON",
    source: "zeek/conn.log",
    sourceIp: "10.0.0.5",
    destIp: attackerIp,
    action: "OUTBOUND_BEACON",
    message: `Outbound connection established from compromised host 10.0.0.5 to external C2 address ${attackerIp}:8443`,
    raw: `Oct 10 08:43:55 ids zeek: conn.log: ts=1728559435 uid=C9Z7k src=10.0.0.5:49182 dst=${attackerIp}:8443 proto=tcp service=ssl orig_bytes=1024 resp_bytes=4096`,
  });

  // Sort chronologically
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const env: LabEnv = {
    kind: "siem",
    siem: {
      title: "Operation Phantom Probe — Security Log Investigation",
      description: "Triage authentication logs, correlate brute force attempts, and extract the malicious persistence payload.",
      events,
    },
  };

  return {
    env,
    answers: {
      attackerIp,
      targetUser,
      failedCount: String(failedAttempts),
      serviceName: backdoorService,
      flag,
    },
  };
}

import type { LabEnv } from "@/lib/lab-engine/env";
import type { Rng } from "./rng";
import { filesPerms } from "./terminal/files-perms";
import { firstTerminal } from "./terminal/first-terminal";
import { r0Challenge } from "./terminal/r0-challenge";
import { ipLab } from "./network/ip-lab";
import { reachLab } from "./network/reach-lab";
import { webLab } from "./network/web-lab";
import { scanLab } from "./packet/scan-lab";
import { dnsLab } from "./packet/dns-lab";
import { httpLab } from "./packet/http-lab";
import { permsLab } from "./linux/perms-lab";
import { procLab } from "./linux/proc-lab";
import { suidLab } from "./linux/suid-lab";
import { registryLab } from "./windows/registry-lab";
import { eventlogLab } from "./windows/eventlog-lab";
import { r1Challenge } from "./terminal/r1-challenge";

import { sqliLab } from "./webapp/sqli-lab";
import { xssLab } from "./webapp/xss-lab";
import { idorLab } from "./webapp/idor-lab";
import { r2Challenge } from "./webapp/r2-challenge";
import { siemInvestigation } from "./siem/siem-investigation";
import { socScenario } from "./soc/soc-scenario";

import { pentestPacketScan } from "./packet/pentest-packet-scan";
import { pentestServicesEnum } from "./terminal/pentest-services-enum";
import { pentestWebAttacks } from "./webapp/pentest-web-attacks";
import { pentestHashcrack } from "./terminal/pentest-hashcrack";
import { pentestLinuxPrivesc } from "./terminal/pentest-linux-privesc";
import { pentestPivotAnalysis } from "./packet/pentest-pivot-analysis";
import { pentestCapstone } from "./webapp/pentest-capstone";

export type GeneratorOutput = { env: LabEnv; answers: Record<string, string> };

// Params come from lab.yaml, so generators validate what they read.
export type Generator = (rng: Rng, params: Record<string, unknown>) => GeneratorOutput;

/** Registered by name; lab.yaml `dataset.generator` picks one. */
export const GENERATORS: Record<string, Generator> = {
  files_perms: filesPerms,
  first_terminal: firstTerminal,
  r0_challenge: r0Challenge,
  r1_challenge: r1Challenge,
  ip_lab: ipLab,
  reach_lab: reachLab,
  web_lab: webLab,
  scan_lab: scanLab,
  dns_lab: dnsLab,
  http_lab: httpLab,
  perms_lab: permsLab,
  proc_lab: procLab,
  suid_lab: suidLab,
  win_registry_lab: registryLab,
  win_eventlog_lab: eventlogLab,
  sqli_lab: sqliLab,
  xss_lab: xssLab,
  idor_lab: idorLab,
  r2_challenge: r2Challenge,
  siem_investigation: siemInvestigation,
  soc_scenario: socScenario,
  pentest_packet_scan: pentestPacketScan,
  pentest_services_enum: pentestServicesEnum,
  pentest_web_attacks: pentestWebAttacks,
  pentest_hashcrack: pentestHashcrack,
  pentest_linux_privesc: pentestLinuxPrivesc,
  pentest_pivot_analysis: pentestPivotAnalysis,
  pentest_capstone: pentestCapstone,
};

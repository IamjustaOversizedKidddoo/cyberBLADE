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
import { netrangeFootholdPrivesc } from "./netrange/netrange-foothold-privesc";
import { netrangeWebCredReuse } from "./netrange/netrange-web-cred-reuse";
import { netrangePivotInternal } from "./netrange/netrange-pivot-internal";
import { netrangeWindowsSmbPrivesc } from "./netrange/netrange-windows-smb-privesc";
import { netrangeMiniExam } from "./netrange/netrange-mini-exam";

import { pentestOsint } from "./terminal/pentest-osint";
import { pentestNmapScan } from "./terminal/pentest-nmap-scan";
import { pentestCleartextCreds } from "./packet/pentest-cleartext-creds";
import { pentestVulnTriage } from "./terminal/pentest-vuln-triage";
import { pentestWebSqliUnion } from "./webapp/pentest-web-sqli-union";
import { pentestWebSqliBlind } from "./webapp/pentest-web-sqli-blind";
import { pentestWebCmdi } from "./webapp/pentest-web-cmdi";
import { pentestWebXss } from "./webapp/pentest-web-xss";
import { pentestWebUpload } from "./webapp/pentest-web-upload";
import { pentestWebIdor } from "./webapp/pentest-web-idor";
import { pentestMsfExploit } from "./terminal/pentest-msf-exploit";
import { pentestHydraBrute } from "./terminal/pentest-hydra-brute";
import { pentestSuidPrivesc } from "./terminal/pentest-suid-privesc";
import { pentestCronPrivesc } from "./terminal/pentest-cron-privesc";
import { pentestWinPrivesc } from "./terminal/pentest-win-privesc";
import { pentestTunnelTriage } from "./terminal/pentest-tunnel-triage";

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
  netrange_foothold_privesc: netrangeFootholdPrivesc,
  netrange_web_cred_reuse: netrangeWebCredReuse,
  netrange_pivot_internal: netrangePivotInternal,
  netrange_windows_smb_privesc: netrangeWindowsSmbPrivesc,
  netrange_mini_exam: netrangeMiniExam,
  pentest_osint_recon: pentestOsint,
  pentest_nmap_scan: pentestNmapScan,
  pentest_cleartext_creds: pentestCleartextCreds,
  pentest_vuln_triage: pentestVulnTriage,
  pentest_web_sqli_union: pentestWebSqliUnion,
  pentest_web_sqli_blind: pentestWebSqliBlind,
  pentest_web_cmdi: pentestWebCmdi,
  pentest_web_xss: pentestWebXss,
  pentest_web_upload: pentestWebUpload,
  pentest_web_idor: pentestWebIdor,
  pentest_msf_exploit: pentestMsfExploit,
  pentest_hydra_brute: pentestHydraBrute,
  pentest_suid_privesc: pentestSuidPrivesc,
  pentest_cron_privesc: pentestCronPrivesc,
  pentest_win_privesc: pentestWinPrivesc,
  pentest_tunnel_triage: pentestTunnelTriage,
};


export type LabDebrief = {
  concept: string;
  realWorld: string;
  commonMistake: string;
  goFurther: string;
};

export const LAB_DEBRIEFS: Record<string, LabDebrief> = {
  "core-r0-files-lab-01": {
    concept: "File permissions and discretionary access controls (POSIX DAC).",
    realWorld: "Investigating sensitive config files like /etc/shadow or private SSH keys left readable by unprivileged accounts.",
    commonMistake: "Assuming files inside a shared directory inherit strict folder privacy automatically.",
    goFurther: "Inspect default umask values on Linux systems to see how new files are created.",
  },
  "core-r0-terminal-lab-01": {
    concept: "Command-line pipeline navigation, text processing, and log inspection.",
    realWorld: "SOC analyst triaging SSH authentication failure bursts in /var/log/auth.log during an incident.",
    commonMistake: "Running commands from the wrong working directory without checking pwd.",
    goFurther: "Use grep with regex (-E) and awk to filter IP addresses directly from raw server logs.",
  },
  "core-r0-challenge-01": {
    concept: "Integrated Linux terminal incident triage under time pressure.",
    realWorld: "Junior security analyst completing their first tier-1 live system investigation.",
    commonMistake: "Panicking over time limits instead of running systematic ls and grep queries.",
    goFurther: "Practice shell aliases to speed up repetitive security auditing commands.",
  },
  "core-r1-net-ip-lab-01": {
    concept: "IPv4 interface addressing, subnet masks, and network boundaries.",
    realWorld: "Network security engineer mapping perimeter interface subnets to isolate DMZ traffic.",
    commonMistake: "Confusing network broadcast addresses with usable client host IP addresses.",
    goFurther: "Calculate usable host counts for variable-length subnet masks (VLSM) /28 and /29.",
  },
  "core-r1-net-reach-lab-01": {
    concept: "Layer 2 ARP resolution and Layer 3 ICMP path discovery.",
    realWorld: "Troubleshooting network segmentation barriers and detecting ARP spoofing attacks.",
    commonMistake: "Assuming a host is down when ping fails, ignoring firewall ICMP drops.",
    goFurther: "Run traceroute with TCP SYN packets to map firewalled internal routers.",
  },
  "core-r1-pkt-scan-lab-01": {
    concept: "TCP three-way handshake and SYN port scanning detection.",
    realWorld: "SOC analyst correlating network intrusion alerts from Nmap reconnaissance sweeps.",
    commonMistake: "Confusing closed RST packets with filtered drops by stateful firewalls.",
    goFurther: "Analyze how stealth FIN, Xmas, and Null scans bypass legacy stateless firewalls.",
  },
  "core-r1-pkt-dns-lab-01": {
    concept: "DNS query resolution flow and record types (A, AAAA, MX, NS).",
    realWorld: "Detecting DNS tunneling exfiltration and fast-flux C2 malware infrastructure.",
    commonMistake: "Believing recursive resolvers hold authoritative zone records directly.",
    goFurther: "Inspect DNS-over-HTTPS (DoH) traffic and its impact on corporate security visibility.",
  },
  "core-r1-net-web-lab-01": {
    concept: "HTTP protocol transactions, response status codes, and redirect loops.",
    realWorld: "Verifying HTTPS redirection rules and security headers on production web servers.",
    commonMistake: "Ignoring 301 versus 302 redirect caching behaviors during security audits.",
    goFurther: "Inspect TLS cipher suites and certificate chains using openssl s_client.",
  },
  "core-r1-pkt-http-lab-01": {
    concept: "Unencrypted protocol analysis and HTTP packet payload decoding.",
    realWorld: "Demonstrating credential interception over insecure Wi-Fi / legacy internal networks.",
    commonMistake: "Thinking HTTP Basic Auth offers encryption rather than base64 encoding.",
    goFurther: "Configure Wireshark display filters to extract session cookies and POST bodies.",
  },
  "core-r1-linux-perms-lab-01": {
    concept: "Linux octal permission auditing and world-writable vulnerability triage.",
    realWorld: "Auditing host CIS benchmarks to ensure sensitive binaries cannot be modified.",
    commonMistake: "Applying chmod 777 to resolve permission errors instead of least privilege.",
    goFurther: "Use auditd to monitor unauthorized permission alterations on critical binaries.",
  },
  "core-r1-linux-proc-lab-01": {
    concept: "Linux process inspection, /proc virtual filesystem, and signal termination.",
    realWorld: "Detecting and killing disguised cryptominer or reverse shell processes on Linux hosts.",
    commonMistake: "Relying solely on process names without checking binary paths in /proc/<pid>/exe.",
    goFurther: "Inspect open network sockets for running processes via /proc/<pid>/net/tcp.",
  },
  "core-r1-linux-suid-lab-01": {
    concept: "SUID/SGID privilege escalation vectors and sudo configuration auditing.",
    realWorld: "Penetration tester identifying GTFOBins binaries to escalate from user to root.",
    commonMistake: "Granting sudo rights to interactive shells (vi, less, nmap) without restrictions.",
    goFurther: "Search for custom binaries with SUID bits set in non-standard directories.",
  },
  "core-r1-siem-log-analysis-01": {
    concept: "SIEM event log correlation, authentication anomalies, and brute-force detection.",
    realWorld: "SOC Tier 1 responder identifying credential stuffing against domain controllers.",
    commonMistake: "Evaluating single failed logins without checking frequency and account spread.",
    goFurther: "Write Sigma rules to detect password spraying across diverse log sources.",
  },
  "core-r1-win-registry-lab-01": {
    concept: "Windows Registry Autostart Execution Points (ASEPs) and persistence.",
    realWorld: "Incident responder discovering malware persistence keys in HKLM Run and RunOnce.",
    commonMistake: "Only checking HKCU and missing system-wide HKLM or startup folder entries.",
    goFurther: "Investigate Scheduled Tasks and WMI event subscriptions for fileless persistence.",
  },
  "core-r1-win-eventlog-lab-01": {
    concept: "Windows Security Event IDs (4624, 4625, 7045) and forensic auditing.",
    realWorld: "Detecting lateral movement and unauthorized service installations via event logs.",
    commonMistake: "Overlooking logon types (Type 2 interactive vs Type 3 network logon).",
    goFurther: "Analyze Sysmon Event ID 1 (Process Creation) command-line arguments for PowerShell.",
  },
  "core-r1-challenge-01": {
    concept: "Multi-domain incident response operation covering Network, Linux, and Windows.",
    realWorld: "Comprehensive enterprise security incident containment across hybrid environments.",
    commonMistake: "Getting tunnel vision on one host while adversary expands lateral movement.",
    goFurther: "Develop an incident response playbook documenting triage timelines.",
  },
  "core-r2-idor-lab-01": {
    concept: "Insecure Direct Object References (IDOR / BOLA) in web applications.",
    realWorld: "Bug bounty hunter discovering horizontal privilege escalation in REST API parameters.",
    commonMistake: "Relying on client-side UI hiding rather than server-side session authorization.",
    goFurther: "Implement GUIDs and cryptographically signed session tokens to mitigate enumeration.",
  },
  "core-r2-sqli-lab-01": {
    concept: "SQL Injection vulnerabilities, authentication bypass, and UNION data exfiltration.",
    realWorld: "Web application penetration tester auditing database-backed login interfaces.",
    commonMistake: "Attempting input sanitization / regex blacklists instead of parameterized queries.",
    goFurther: "Use prepared statements with PDO/ORM to eliminate SQL syntax interpolation.",
  },
  "core-r2-xss-lab-01": {
    concept: "Cross-Site Scripting (Reflected & Stored XSS) and DOM context injection.",
    realWorld: "Securing modern web apps against cookie theft, session hijacking, and defacement.",
    commonMistake: "Failing to contextually encode user inputs before reflecting them into HTML.",
    goFurther: "Deploy a Content Security Policy (CSP) with strict nonces to disarm inline scripts.",
  },
  "core-r2-challenge-01": {
    concept: "Full-stack web application penetration testing operation and exploit chaining.",
    realWorld: "Executing an end-to-end web security assessment from reconnaissance to data extraction.",
    commonMistake: "Stopping after discovering one bug instead of chaining vulnerabilities for impact.",
    goFurther: "Automate web vulnerability scans using OWASP ZAP in a CI/CD build pipeline.",
  },
  "soc-noisy-shift-01": {
    concept: "Tier-1 SOC alert triage, noise reduction, and correlation under alert fatigue.",
    realWorld: "Enterprise SOC analyst working an alert queue, separating true threats from benign noise.",
    commonMistake: "Over-escalating benign administrative actions or closing active adversary alerts as false alarms.",
    goFurther: "Write Sigma detection rules to tune noisy alerts at the source.",
  },
  "soc-fam-phishing-cred-01": {
    concept: "Credential harvesting phishing triage, deceptive link analysis, and mailbox compromise detection.",
    realWorld: "SOC Tier-1 analyst triaging reported suspicious emails containing typo-squatted login portals.",
    commonMistake: "Relying purely on sender display name rather than analyzing Return-Path and auth headers.",
    goFurther: "Configure automated mail gateway transport rules and DMARC quarantine policies.",
  },
  "soc-fam-attachment-script-01": {
    concept: "Malicious attachment triage, script-based loaders (PowerShell, VBScript), and child process execution.",
    realWorld: "Detecting initial access loaders masquerading as invoices or shipping documents on employee endpoints.",
    commonMistake: "Classifying an attachment as benign before checking downstream process spawning in EDR telemetry.",
    goFurther: "Implement Attack Surface Reduction (ASR) rules blocking Office apps from creating child processes.",
  },
  "soc-fam-brute-force-auth-01": {
    concept: "Authentication anomaly detection, credential stuffing bursts, and distributed password spraying.",
    realWorld: "Investigating distributed SSH and VPN brute-force campaigns originating from multiple external IPs.",
    commonMistake: "Filtering by single source IP instead of aggregating failed attempts across target usernames.",
    goFurther: "Deploy adaptive MFA lockouts and geo-velocity anomaly alerts on corporate identity providers.",
  },
  "soc-fam-web-attack-data-01": {
    concept: "Web application intrusion detection, SQLi/RCE payloads, and HTTP error code correlation.",
    realWorld: "Analyzing web server access logs to distinguish automated vulnerability scanner noise from successful exploit executions.",
    commonMistake: "Assuming all 200 OK responses indicate successful exploitation without checking response sizes and database error logs.",
    goFurther: "Correlate WAF block signatures with backend application exception telemetry.",
  },
  "soc-fam-outbound-exfil-01": {
    concept: "Data exfiltration detection, abnormal outbound byte spikes, and unauthorized cloud upload channels.",
    realWorld: "Triaging proxy and firewall connection spikes to unapproved file sharing sites or staging servers.",
    commonMistake: "Focusing solely on packet counts rather than total transferred bytes and destination reputations.",
    goFurther: "Build network baseline anomaly alerts for outbound traffic outside normal business hours.",
  },
  "soc-fam-insider-policy-01": {
    concept: "Insider threat hunting, bulk removable media transfers, and unauthorized sensitive directory access.",
    realWorld: "Identifying departing employees staging confidential source code or customer databases onto USB storage.",
    commonMistake: "Dismissing high-volume file transfers as authorized work without correlating with employee departure notices.",
    goFurther: "Implement host-based DLP agent alerts and USB mass-storage write restrictions.",
  },
  "soc-fam-cloud-identity-01": {
    concept: "Cloud IAM auditing, impossible travel anomalies, and suspicious administrative role grants.",
    realWorld: "Detecting compromised cloud tenant credentials initiating unauthorized API tokens or privilege escalations.",
    commonMistake: "Ignoring concurrent login locations when corporate VPN split-tunneling creates artificial geo-diversity.",
    goFurther: "Enforce conditional access policies requiring managed device compliance for all cloud logins.",
  },
  "soc-fam-alert-fatigue-01": {
    concept: "Alert fatigue management, true-threat prioritization, and batch triage under high queue volume.",
    realWorld: "Triaging high-volume SOC queues during telemetry storms without overlooking critical true positives.",
    commonMistake: "Carelessly bulk-closing repetitive alerts without validating host identity and payload variants.",
    goFurther: "Tune alert detection thresholds and write aggregation rules to reduce false alarm spam.",
  },
  "soc-shift-quiet-day": {
    concept: "Routine SOC shift operations, baseline verification, and low-volume alert queue maintenance.",
    realWorld: "Working a quiet shift where meticulous validation prevents benign administrative actions from escalating unnecessarily.",
    commonMistake: "Rushing through quiet queues without thoroughly documenting rationale for false positive dispositions.",
    goFurther: "Use shift downtime to conduct proactive threat hunting and review detection rule health.",
  },
  "soc-shift-standard-mixed": {
    concept: "Multi-incident shift triage, cross-alert correlation, and operational priority ranking.",
    realWorld: "Balancing multiple simultaneous incident leads ranging from suspicious emails to unusual outbound network traffic.",
    commonMistake: "Fixating on the first alert received rather than triaging the queue by business risk and severity.",
    goFurther: "Practice structured shift handovers summarizing open containment actions and unresolved artifacts.",
  },
  "soc-shift-alert-storm": {
    concept: "High-stress alert storm triage, rapid noise suppression, and critical incident containment.",
    realWorld: "Surviving a major telemetry spike during a synchronized attack while keeping SLA response times intact.",
    commonMistake: "Becoming overwhelmed by alarm volume and abandoning structured investigation checklists.",
    goFurther: "Establish incident escalation triggers that notify senior analysts before queues breach SLA limits.",
  },
  "soc-shift-night-telemetry-gaps": {
    concept: "Incomplete telemetry triage, blind-spot navigation, and corroborating partial audit evidence.",
    realWorld: "Investigating overnight security events when log forwarders fail or critical endpoints are offline.",
    commonMistake: "Closing an unverified alert as benign simply because a key log source is missing.",
    goFurther: "Document telemetry blind spots and trigger secondary evidence collection from adjacent network taps.",
  },
};

export function getLabDebrief(labId: string): LabDebrief | undefined {
  return LAB_DEBRIEFS[labId];
}

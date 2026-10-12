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
};

export function getLabDebrief(labId: string): LabDebrief | undefined {
  return LAB_DEBRIEFS[labId];
}

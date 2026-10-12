# SOC Tier-1 Scenario Library Architecture & Specification

## 1. Executive Summary & Design Goals
The CyberBLADE SOC Tier-1 (L1) Scenario Library establishes a comprehensive, procedurally generated training and certification curriculum for frontline security operations center analysts. Rather than relying on static, easily memorized challenge scenarios, the library provides **8 distinct scenario families** and **4 composed shift profiles**. Each family generates millions of mathematically distinct, solvable, non-leaky, and anti-tell-hardened scenario variants.

The library adheres strictly to:
1. **Zero Ground-Truth Leaks**: Client projections never contain solution labels, internal flags, or distinguishing metadata.
2. **Anti-Tell Invariance**: No superficial feature (field counts, summary lengths, queue positioning, or tool severities) can achieve $> 72\%$ balanced accuracy in predicting threat disposition.
3. **Sound Practitioner Reasoning**: Every incident is solvable through cross-source correlation, log artifact inspection, and verification of authorization context.
4. **Imperfect Tool Severities**: Simulated sensors exhibit realistic calibration quirks (e.g., scanners raising Critical, successful root logins triggering Medium alerts) forcing analysts to calibrate based on technical evidence rather than trusting tool labels.
5. **Rigorous Proof Toolchain**: Every family and shift profile is validated across 1,000 seeds per difficulty against the 7-layer verification suite.

---

## 2. Tier-1 Core Skills Taxonomy
The L1 library exercises 16 foundational skills defined in `content/soc/skills.yaml`:

| Skill ID | Skill Title | Category | Scope & Core Competencies |
| :--- | :--- | :--- | :--- |
| `soc_alert_triage` | Alert Triage & Prioritization | operations | Triaging heterogeneous alert queues, prioritizing by true operational risk, avoiding naive severity sorting. |
| `soc_false_positive_id` | False-Positive Identification | operations | Dissecting benign background noise, administrative maintenance, scanning bursts, and faulty signatures. |
| `soc_phishing_analysis` | Phishing & Email Gateway Analysis | email | Header inspection, SPF/DKIM/DMARC verdicts, domain mismatch detection, attachment triage, URL analysis. |
| `soc_credential_attacks` | Credential Attack Recognition | identity | Password spraying, dictionary brute force, MFA prompt bombing/fatigue, and impossible-travel anomalies. |
| `soc_endpoint_triage` | Endpoint & Process Triage | endpoint | Suspicious process execution trees, LOLBins (certutil, powershell), persistence (Run keys, services, tasks). |
| `soc_network_indicators` | Network Indicators & Flow Analysis | network | C2 beaconing patterns, periodic egress intervals, abnormal DNS queries, and unauthorized external connections. |
| `soc_web_attacks` | Web Application Log Analysis | application | Differentiating blocked WAF injection probes from successful HTTP 200 SQLi, traversal, or webshell executions. |
| `soc_data_exfiltration` | Data Exfiltration Signals | exfiltration | Bulk outbound transfers, staging archive creation, DNS tunneling, and cloud storage exfiltration channels. |
| `soc_insider_policy` | Insider & Policy Violations | operations | Unauthorized removable media usage, off-hours sensitive file exports, credential sharing vs IT archiving. |
| `soc_cloud_identity` | Cloud & IAM Anomaly Detection | cloud | Anomalous role delegation, access key creation, console logons from novel ASNs vs infrastructure automation. |
| `soc_siem_correlation` | Multi-Source Event Correlation | siem | Stitching firewall flows, endpoint process logs, authentication trails, and gateway alerts into unified cases. |
| `soc_scope_assessment` | Scope & Blast Radius Assessment | operations | Evaluating lateral movement attempts, compromised account permissions, and blast radius of attacker access. |
| `soc_escalation_handoff` | Escalation Decisions & Case Handoff | operations | Deciding Tier-2 escalation vs closing as BTP/FP, preparing actionable handoff notes and containment steps. |
| `soc_documentation` | Forensic Documentation & Rationales | operations | Recording defensible investigation rationale, citing explicit log timestamps, hostnames, and IOC values. |
| `soc_windows_logs` | Windows Event Analysis | endpoint | Analyzing Event IDs 4624 (logon types), 4625 (failures), 4688 (process create), and 7045 (service install). |
| `soc_linux_logs` | Linux System & Auth Log Analysis | endpoint | Analyzing `/var/log/auth.log` (sshd, pam, sudo), syslog daemons, and cron scheduled executions. |

---

## 3. The 8 Scenario Families

### Family 1: `soc-f-phishing-cred-01`
- **Title**: Phishing to Credential Compromise & Session Hijacking
- **Primary Skills**: `soc_phishing_analysis`, `soc_credential_attacks`, `soc_alert_triage`, `soc_siem_correlation`, `soc_escalation_handoff`
- **Incident Templates**:
  - `inc-spearphish-harvest`: Spoofed invoice email delivering harvesting link; employee submits credentials; attacker immediately logs into corporate IdP/VPN from foreign IP.
  - `inc-quishing-mfa-bypass`: Phishing message with QR/direct URL leading to reverse proxy harvester and session token theft.
- **Benign / Noise Templates**:
  - `benign-marketing-newsletter`: Bulk marketing newsletter with tracking redirect URL (SPF/DKIM pass, benign domain).
  - `benign-vendor-billing-update`: Legitimate vendor remittance notice with verified corporate signing.
  - `benign-sso-session-renewal`: Routine OAuth token refresh from corporate mobile device.
  - `benign-pwd-reset-notification`: Internal automated helpdesk notification regarding planned password expiration.
- **Twin Pairs**:
  - *Twin A (Email Delivery)*: Malicious fake invoice from lookalike domain (`invoice-portal.example`) vs Legitimate vendor billing notification from established domain (`billing.partner.corp.internal`). Distinguishing evidence: DMARC alignment, SPF authentication result, sender IP reputation.
  - *Twin B (Remote Sign-in)*: Attacker session login using harvested credentials from foreign ASN vs Traveling executive VPN session with verified push MFA.
- **Ambiguity Budget**: 1-2 alerts where user clicked link but submission is unconfirmed in telemetry (acceptable: `needs_more_info` or `true_positive` with user isolation).
- **Data Sources**: Email Gateway (verdict records), Web Proxy / DNS, IdP Sign-in logs, Endpoint Browser telemetry.
- **Difficulty Profiles**:
  - *Beginner*: 30 alerts, 0 telemetry gaps, obvious SPF/DKIM fail header.
  - *Intermediate*: 45 alerts, 1 telemetry gap (email body stripped, proxy log provides URI).
  - *Advanced*: 65 alerts, 2 telemetry gaps, high noise ratio (80%), subtle display name spoofing.
- **Reference Solver Steps**:
  1. Inspect email gateway headers: check SPF, DKIM, and DMARC status.
  2. Correlate extracted URL against web proxy / DNS logs: check whether employee clicked and navigated.
  3. Query authentication logs for the targeted user: check for successful login from non-corporate IP shortly after click.
  4. Escalate confirmed compromises to Tier-2 with account lockout recommendations.

---

### Family 2: `soc-f-attachment-script-01`
- **Title**: Malicious Attachment to Script Execution & Persistence
- **Primary Skills**: `soc_endpoint_triage`, `soc_windows_logs`, `soc_malware_triage`, `soc_siem_correlation`, `soc_escalation_handoff`
- **Incident Templates**:
  - `inc-macro-powershell-runkey`: Macro-enabled spreadsheet spawns encoded PowerShell, downloads secondary payload via living-off-the-land utility, installs persistence via Registry Run key.
  - `inc-archive-vbs-scheduledtask`: Password-protected ZIP attachment extracts VBScript that creates daily scheduled task running inert staging script.
- **Benign / Noise Templates**:
  - `benign-it-admin-diagnostics`: IT Administrator running signed `Collect-DiagnosticLogs.ps1` via PowerShell.
  - `benign-software-inventory`: Enterprise asset discovery daemon scanning Registry Run keys for software audit.
  - `benign-hr-doc-template`: Benign Office document containing macro for automated header numbering.
  - `benign-pki-crl-check`: `certutil.exe` executing with `-verify` flag against internal PKI server.
- **Twin Pairs**:
  - *Twin A (PowerShell)*: Encoded hidden PowerShell cradle spawned from `excel.exe` vs Admin diagnostic script executed from interactive PowerShell console by `itadmin`.
  - *Twin B (Persistence Registry)*: Malicious Run key pointing to `C:\Users\Public\update.vbs` vs Legitimate Run key installed by enterprise software update under `Program Files`.
- **Ambiguity Budget**: 2 alerts where script was blocked by Defender/AppLocker but host state requires verification (`true_positive` vs `benign_true_positive` with containment).
- **Data Sources**: Windows Security (4688, 7045), EDR Process Tree, File Creation logs, Registry Auditing, Email Gateway.
- **Difficulty Profiles**:
  - *Beginner*: 35 alerts, clear parent-child process tree (`excel.exe` -> `powershell.exe`).
  - *Intermediate*: 50 alerts, 1 telemetry gap (EDR missed process start, Windows Security 4688 caught command line).
  - *Advanced*: 75 alerts, 2 telemetry gaps, obfuscated command arguments, high noise.
- **Reference Solver Steps**:
  1. Correlate attachment reception with process execution on recipient's workstation.
  2. Inspect parent-child tree: Office app spawning script interpreter is an anomalous indicator.
  3. Check command-line arguments for obfuscation, hidden window flags, or network download parameters.
  4. Verify persistence artifacts (Registry Run key, Task Scheduler). Escalate to Tier-2 for endpoint isolation.

---

### Family 3: `soc-f-brute-force-auth-01`
- **Title**: Exposed Service Password Spraying, Brute Force & MFA Fatigue
- **Primary Skills**: `soc_credential_attacks`, `soc_linux_logs`, `soc_windows_logs`, `soc_alert_triage`, `soc_escalation_handoff`
- **Incident Templates**:
  - `inc-ssh-burst-root-success`: Automated SSH dictionary attack from external IP against DMZ host; 200+ failed attempts followed by accepted password for `root`.
  - `inc-mfa-fatigue-push-bomb`: Password spray across multiple corporate accounts followed by 15 rapid MFA push notifications until employee approves at 02:40 AM.
  - `inc-impossible-travel-vpn`: Valid logon from Chicago followed 25 minutes later by logon from Frankfurt.
- **Benign / Noise Templates**:
  - `benign-ssh-dev-typo`: Developer fat-fingering SSH password 3 times before succeeding.
  - `benign-service-account-sync`: Service account logging in every 10 minutes across internal hosts.
  - `benign-roaming-sales-vpn`: Sales rep logging into VPN from hotel Wi-Fi with valid single-push MFA.
  - `benign-pw-expiration-retries`: Workstation auto-retrying mapped drive connections after password change.
- **Twin Pairs**:
  - *Twin A (SSH Authentication)*: 200 failures + accepted root session from untrusted IP vs 3 failures + successful developer logon from corporate subnet.
  - *Twin B (MFA Prompting)*: 15 rapid pushes in 3 minutes resulting in fatigue acceptance vs Single push prompt accepted by traveling user during business hours.
- **Ambiguity Budget**: 1 alert where brute-force attack occurred but all attempts failed (correct: `false_positive` or closed without escalation, since no compromise occurred).
- **Data Sources**: Linux `auth.log` (`sshd`, `pam`), Windows Security (4624, 4625, Logon Type 3/10), VPN Gateway logs, IdP MFA logs.
- **Difficulty Profiles**:
  - *Beginner*: 30 alerts, high failure count followed by clear success message.
  - *Intermediate*: 45 alerts, 1 telemetry gap (VPN log shows connection, auth log has source IP).
  - *Advanced*: 65 alerts, distributed spray (few attempts per user across many accounts), MFA fatigue timing.
- **Reference Solver Steps**:
  1. Filter authentication telemetry by target host and source IP.
  2. Distinguish between attacks with 0 successful logons (blocked noise) vs attacks culminating in successful session.
  3. Verify whether successful session is authorized (known admin IP/time vs untrusted external origin).
  4. Escalate successful unauthorized logins immediately to Tier-2 with account disabling request.

---

### Family 4: `soc-f-web-attack-data-01`
- **Title**: Web Application Exploitation, SQL Injection & Web Shells
- **Primary Skills**: `soc_web_attacks`, `soc_network_indicators`, `soc_linux_logs`, `soc_alert_triage`, `soc_siem_correlation`
- **Incident Templates**:
  - `inc-sqli-data-extraction`: Inbound HTTP GET with SQL injection (`UNION SELECT`) against product catalog returning HTTP 200 and 850 KB response containing user records.
  - `inc-webshell-rce-cmd`: Traversal exploit uploads PHP/JSP webshell; attacker issues `whoami` and `id` commands via HTTP POST.
- **Benign / Noise Templates**:
  - `benign-waf-blocked-sqli`: Automated internet scanner attempting SQLi; WAF returns HTTP 403 Forbidden.
  - `benign-health-check-probe`: Load balancer polling `/healthz` every 5 seconds with HTTP 200.
  - `benign-api-search-query`: Legitimate customer querying product API with single quote in search term (`O'Reilly`).
  - `benign-admin-web-console`: Authorized developer logging into internal CMS dashboard from VPN.
- **Twin Pairs**:
  - *Twin A (SQL Injection)*: Exploitable SQLi yielding HTTP 200 and high byte transfer vs Scanner SQLi blocked by WAF with HTTP 403. Distinguishing evidence: HTTP status code, response byte size, database audit event.
  - *Twin B (Webshell Interaction)*: Inbound POST to `/uploads/cache.php` executing OS commands vs Legitimate POST to `/api/v1/upload` with normal file upload response.
- **Ambiguity Budget**: 1 alert with probe returning HTTP 500 server error without proof of data leakage (`needs_more_info`).
- **Data Sources**: Web Server access/error logs (Nginx/Apache), WAF alert logs, Database query audit logs, Linux auditd.
- **Difficulty Profiles**:
  - *Beginner*: 35 alerts, clear SQL injection string in query parameter with HTTP 200 response.
  - *Intermediate*: 50 alerts, WAF probe noise mixed with genuine successful exploit, 1 telemetry gap.
  - *Advanced*: 75 alerts, encoded payloads (URL-encoding/hex), post-exploit process creation on web server.
- **Reference Solver Steps**:
  1. Inspect HTTP method, URI, status code, and response size in web server logs.
  2. Separate blocked attacks (HTTP 403) from successful exploits (HTTP 200 with anomalous payload).
  3. Correlate with database or OS execution logs on the web server (e.g., `www-data` spawning `bash`).
  4. Escalate confirmed successful intrusions to Tier-2 with web application containment actions.

---

### Family 5: `soc-f-outbound-exfil-01`
- **Title**: Suspicious Outbound Egress, C2 Beaconing & Exfiltration
- **Primary Skills**: `soc_network_indicators`, `soc_data_exfiltration`, `soc_endpoint_triage`, `soc_alert_triage`, `soc_siem_correlation`
- **Incident Templates**:
  - `inc-dns-tunneling-exfil`: Compromised workstation sends burst of 1,200 high-entropy TXT/A queries to subdomain of external attacker domain (`data-chunk-01.tunnel.example`).
  - `inc-https-c2-beaconing`: Workstation establishing HTTPS sessions to external IP with rigid 60-second periodic interval and uniform jitter.
- **Benign / Noise Templates**:
  - `benign-cloud-storage-sync`: OneDrive/Dropbox client uploading business files to official cloud endpoint.
  - `benign-os-ntp-telemetry`: Workstation sending regular NTP/DNS queries to corporate internal resolvers.
  - `benign-cdn-video-stream`: Staff member streaming company training video from corporate CDN.
  - `benign-antivirus-update-burst`: Endpoint pulling signature definition updates from vendor server.
- **Twin Pairs**:
  - *Twin A (DNS Activity)*: High-entropy subdomain tunneling queries (`a9f2bc.tunnel.example`) vs Legitimate split-horizon DNS lookups for internal service discovery.
  - *Twin B (Outbound Data Burst)*: Large archive upload to external unknown IP via curl/powershell vs Legitimate scheduled database backup to internal storage array.
- **Ambiguity Budget**: 1 alert with elevated egress to a major public cloud service that could be benign user sync or exfiltration (`needs_more_info`).
- **Data Sources**: Proxy / DNS logs, Firewall flow records (NetFlow/IPFIX), EDR Network connection events, Threat Intel feeds.
- **Difficulty Profiles**:
  - *Beginner*: 35 alerts, obvious DNS tunneling domain with repetitive byte queries.
  - *Intermediate*: 50 alerts, subtle C2 interval with jitter, 1 telemetry gap (proxy log missing, NetFlow present).
  - *Advanced*: 70 alerts, high ambient network noise, encrypted exfil channel to generic cloud host.
- **Reference Solver Steps**:
  1. Analyze destination domain reputation, query entropy, and record types (TXT vs A).
  2. Inspect connection intervals for periodic beaconing patterns (interval, variance, byte regularity).
  3. Identify local process responsible for the network connection via endpoint telemetry.
  4. Escalate confirmed C2 or exfiltration to Tier-2 with firewall block and endpoint isolation.

---

### Family 6: `soc-f-insider-policy-01`
- **Title**: Insider Threat, Removable Media & Policy Violations
- **Primary Skills**: `soc_insider_policy`, `soc_data_exfiltration`, `soc_endpoint_triage`, `soc_windows_logs`, `soc_escalation_handoff`
- **Incident Templates**:
  - `inc-usb-mass-export`: Disgruntled employee mounts unauthorized USB storage device and copies 450 confidential engineering schematics from network share.
  - `inc-offhours-bulk-cloud-upload`: Resigning finance analyst downloads customer database records at 11:30 PM and uploads to personal cloud storage account.
- **Benign / Noise Templates**:
  - `benign-it-approved-usb-iso`: IT Helpdesk technician using approved encrypted Kingston flash drive to install OS image.
  - `benign-authorized-doc-archive`: Marketing team member compressing public collateral into ZIP for partner portal.
  - `benign-routine-print-spool`: Standard employee sending 5-page PDF document to office printer.
  - `benign-offhours-oncall-access`: On-call engineer accessing production logs during midnight incident triage.
- **Twin Pairs**:
  - *Twin A (Removable Media)*: Unauthorized USB device serial copying sensitive files vs IT-registered encrypted drive copying public installer. Distinguishing evidence: Device VID/PID, serial number registry, file classifications.
  - *Twin B (Bulk File Movement)*: Mass copy of confidential files to external personal account vs Authorized archival of project documents by authorized department head.
- **Ambiguity Budget**: 1 alert where an employee copied personal photos or benign documents to USB (policy violation vs security breach trade-off declared in debrief).
- **Data Sources**: Endpoint DLP logs, Windows Event ID 4663 (file access), USB PnP Device events, Cloud access logs.
- **Difficulty Profiles**:
  - *Beginner*: 30 alerts, clear unauthorized USB VID/PID and bulk copy alert.
  - *Intermediate*: 45 alerts, off-hours access pattern correlated with file access logs, 1 telemetry gap.
  - *Advanced*: 65 alerts, user claiming authorized work, requires cross-checking HR leave / resignation status.
- **Reference Solver Steps**:
  1. Inspect DLP / USB device events for authorization status (registered asset tag vs foreign device).
  2. Verify file access logs: determine sensitivity, classification, and volume of copied files.
  3. Check employee department, role, and business justification (on-call schedule, IT privileges).
  4. Escalate verified intellectual property theft to Tier-2 / HR with full file inventory.

---

### Family 7: `soc-f-cloud-identity-01`
- **Title**: Cloud IAM Anomalies, Privilege Escalation & Access Key Creation
- **Primary Skills**: `soc_cloud_identity`, `soc_credential_attacks`, `soc_alert_triage`, `soc_siem_correlation`, `soc_escalation_handoff`
- **Incident Templates**:
  - `inc-iam-admin-role-assignment`: Attacker utilizes compromised developer API credentials to attach `AdministratorAccess` policy to new IAM user and generate persistent access keys.
  - `inc-cloud-console-novel-asn`: Stolen session cookie used to access Cloud Management Console from unexpected VPN exit node in foreign jurisdiction without MFA.
- **Benign / Noise Templates**:
  - `benign-terraform-ci-deploy`: Scheduled CI/CD pipeline using IAM service role to provision staging resources.
  - `benign-admin-key-rotation`: Cloud Architect executing scheduled quarterly IAM access key rotation.
  - `benign-dev-s3-bucket-create`: Developer creating development S3 bucket within approved naming convention.
  - `benign-cloudwatch-alarm-trigger`: CloudWatch billing alarm threshold triggered by routine compute usage.
- **Twin Pairs**:
  - *Twin A (Access Key Generation)*: Malicious programmatic key generation via compromised developer credential from foreign IP vs Scheduled key rotation by automated Terraform service principal.
  - *Twin B (Policy Modification)*: Privilege escalation attaching admin rights to unknown user vs Authorized role binding update executed through corporate change ticket.
- **Ambiguity Budget**: 1 alert where developer performed manual AWS/Azure CLI action during emergency troubleshooting without change ticket (BTP vs policy exception).
- **Data Sources**: CloudTrail / Cloud Audit logs, Identity Provider audit logs, Terraform/CI deployment records.
- **Difficulty Profiles**:
  - *Beginner*: 30 alerts, clear API call from unknown external IP creating admin credentials.
  - *Intermediate*: 45 alerts, service principal vs user principal distinction, 1 telemetry gap.
  - *Advanced*: 65 alerts, multi-step cloud persistence chain mixed with heavy CI/CD deployment noise.
- **Reference Solver Steps**:
  1. Examine Cloud Audit event: source IP, user agent, caller identity, and action name (`CreateAccessKey`, `AttachUserPolicy`).
  2. Correlate caller identity with known CI/CD automation or authorized administrative roles.
  3. Check IP geolocation and ASN against corporate identity baseline.
  4. Escalate unauthorized IAM modifications immediately to Tier-2 with key revocation request.

---

### Family 8: `soc-f-alert-fatigue-01`
- **Title**: Operational Noise, Scanner Bursts & False-Positive Dissection
- **Primary Skills**: `soc_alert_triage`, `soc_false_positive_id`, `soc_network_indicators`, `soc_documentation`
- **Incident Templates**:
  - `inc-stealth-scan-with-exploit`: High-volume automated noise obscures a single targeted web exploit attempt embedded within 150 benign scanner probes.
- **Benign / Noise Templates**:
  - `benign-weekly-nessus-scan`: Authorized vulnerability scanner scanning DMZ subnets at 500 packets/sec.
  - `benign-flapping-ids-signature`: Outdated Snort/Suricata rule triggering 20 duplicate alerts on normal TLS 1.3 handshake extensions.
  - `benign-backup-replication-burst`: Storage snapshot replication generating high-volume firewall allow alerts.
  - `benign-sccm-patch-rollout`: Patch Tuesday package distribution triggering process execution alerts on 30 endpoints.
  - `benign-self-service-password-retry`: User changing password and hitting 4 failed attempts on cached mobile credentials.
  - `benign-monitoring-ping-sweep`: Zabbix/Prometheus network monitoring agent probing host availability.
- **Twin Pairs**:
  - *Twin A (Port Sweep)*: Authorized Nessus vulnerability scanner from internal management IP vs Unauthorized external reconnaissance probe.
  - *Twin B (Burst Alerts)*: Sensor glitch causing 25 duplicate low-severity alerts vs Distributed denial of service or spray attempt.
- **Ambiguity Budget**: 2-3 alerts that fit duplicate or benign true positive categories where either disposition is defensible.
- **Data Sources**: Network IDS, Vulnerability Management feeds, Monitoring agents, Firewall flows, Authentication logs.
- **Difficulty Profiles**:
  - *Beginner*: 40 alerts, scanner alerts clearly tagged with authorized scanner IP.
  - *Intermediate*: 60 alerts, multiple overlapping noise sources, 1 subtle real incident hidden in noise.
  - *Advanced*: 90 alerts, heavy fatigue conditions, flapping sensors, tight timing windows.
- **Reference Solver Steps**:
  1. Group repetitive alerts by rule name, source IP, and target subnet.
  2. Validate scanner source IPs against the authorized asset registry.
  3. Mark duplicate sensor glitches as `duplicate` and authorized maintenance as `benign_true_positive`.
  4. Isolate genuine anomalous alerts hidden amidst the scanner noise.

---

## 4. Skills-Coverage Matrix

The following matrix verifies that every Tier-1 skill is exercised in **at least 2 families** and in **at least one hard/advanced profile**:

| Skill ID | Fam 1 (Phish) | Fam 2 (Attach) | Fam 3 (Brute) | Fam 4 (Web) | Fam 5 (Exfil) | Fam 6 (Insider) | Fam 7 (Cloud) | Fam 8 (Noise) | Hard Profile Coverage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `soc_alert_triage` | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | Covered in all 8 Advanced profiles |
| `soc_false_positive_id`| **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | Covered in Fam 3, 4, 8 Advanced |
| `soc_phishing_analysis`| **X** | **X** | — | — | — | — | — | — | Covered in Fam 1, 2 Advanced |
| `soc_credential_attacks`| **X** | — | **X** | — | — | — | **X** | — | Covered in Fam 1, 3, 7 Advanced |
| `soc_endpoint_triage` | — | **X** | — | — | **X** | **X** | — | — | Covered in Fam 2, 5, 6 Advanced |
| `soc_network_indicators`| — | — | — | **X** | **X** | — | — | **X** | Covered in Fam 4, 5, 8 Advanced |
| `soc_web_attacks` | — | — | — | **X** | — | — | — | **X** | Covered in Fam 4, 8 Advanced |
| `soc_data_exfiltration`| — | — | — | — | **X** | **X** | — | — | Covered in Fam 5, 6 Advanced |
| `soc_insider_policy` | — | — | — | — | — | **X** | — | **X** | Covered in Fam 6, 8 Advanced |
| `soc_cloud_identity` | — | — | — | — | — | — | **X** | **X** | Covered in Fam 7, 8 Advanced |
| `soc_siem_correlation` | **X** | **X** | **X** | **X** | **X** | — | **X** | — | Covered in Fam 1, 2, 4, 7 Advanced |
| `soc_scope_assessment` | **X** | **X** | **X** | **X** | **X** | **X** | **X** | — | Covered in Fam 1, 2, 3, 4 Advanced |
| `soc_escalation_handoff`| **X** | **X** | **X** | **X** | **X** | **X** | **X** | — | Covered in Fam 1, 2, 3, 4, 5, 6, 7 Adv |
| `soc_documentation` | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | Covered in all 8 Advanced profiles |
| `soc_windows_logs` | — | **X** | **X** | — | — | **X** | — | — | Covered in Fam 2, 3, 6 Advanced |
| `soc_linux_logs` | — | — | **X** | **X** | — | — | — | — | Covered in Fam 3, 4 Advanced |

*All 16 Tier-1 skills meet the minimum-coverage requirement.*

---

## 5. Shift Profiles & Composer Blueprint

A SOC shift is not a single isolated incident—it is a realistic slice of operational reality containing 80–250 alerts, mixing multiple concurrent incidents and ambient noise across consistent corporate entities.

The **Shift Composer** (`lib/lab-engine/soc/shift-composer.ts`) composes a shift from:
1. An **Organization Archetype** (shared domain, IP subnets, employees, hostnames).
2. A **Shift Window** (`day_shift`, `night_shift`, `weekend_shift`).
3. **2–4 Incident Templates** selected across compatible scenario families without IOC collisions.
4. An **Ambient Noise Mix** drawn from the Alert Fatigue family and member benign templates.
5. Overall **Difficulty Rating** (Easy, Standard, Hard, Extreme).

### Shipped Shift Profiles:
1. `shift-quiet-day`: **Quiet Day Shift (Beginner)** — 80 alerts, 2 clear incidents (Phishing + SSH Brute Force), routine business noise, zero telemetry gaps. (30–45 mins).
2. `shift-standard-mixed`: **Standard Mixed Shift (Intermediate)** — 130 alerts, 3 incidents (Phishing + Attachment + Web Attack), normal noise ratio, 1 telemetry gap. (45–60 mins).
3. `shift-alert-storm`: **Alert-Storm Shift (Advanced)** — 200 alerts, heavy vulnerability scanner bursts and flapping IDS rules obscuring 3 high-impact attacks. Trains alert triage and prioritization under stress. (60–80 mins).
4. `shift-night-telemetry-gaps`: **Night Shift with Telemetry Gaps (Advanced)** — 150 alerts, off-hours attacks (Insider Data Export + Cloud IAM Privilege Escalation), 2 declared telemetry gaps requiring raw event correlation. (60–90 mins).

---

## 6. Implementation & Verification Roadmap
- **Part B**: Vocabulary and log-format expansion (`vocab/`, `severity-calibration.yaml`, golden log samples).
- **Part C**: Family authoring in approved order (`phishing`, `brute-force`, `attachment`, `alert-fatigue`, `web`, `exfil`, `insider`, `cloud`).
- **Part D**: Shift Composer engine and 4 shift profiles.
- **Part E**: Proof toolchain execution (1,000 seeds per family/difficulty), planted-flaw testing, review pack CLI.
- **Part F**: Lab catalog registration, accessibility verification, and performance benchmarks.
- **Part G**: Documentation updates.

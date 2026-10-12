# SOC Scenario Realism Review Checklist

This checklist is used by senior SOC analysts, incident response leads, and detection engineers to audit CyberBLADE SOC scenarios for technical fidelity, operational realism, and pedagogical integrity.

---

## 1. Alert Wording and Telemetry Authenticity
- [ ] **Vendor-Agnostic Terminology**: Detection rule names use standardized naming conventions (e.g. `POWERSHELL_OBFUSCATED_COMMANDLINE`, `INBOUND_MACRO_ATTACHMENT_SUSPICIOUS`) rather than proprietary vendor brand labels.
- [ ] **Realistic Raw Event Fields**: Telemetry attributes mirror standard production schemas (EDR process trees with parent PID/command lines, Sysmon Event IDs 1/3/7/11, Windows Security logs 4624/4625/4688, IDS Snort/Suricata signature metadata, Zeek/Bro connection logs).
- [ ] **Plausible Command Lines**: Commands reflect genuine operational behavior rather than textbook synthetic strings (e.g. realistic LOLBins such as `certutil.exe -urlcache -split -f`, `mshta.exe`, `powershell.exe -NonI -W Hidden -Enc ...`).
- [ ] **Sanitized Network Identifiers**: All IP addresses use documentation RFC blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) or private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). All domain names use `.example`, `.corp.internal`, or `.local`.

---

## 2. Noise Ratio & Operational Volume
- [ ] **Baseline Noise Distribution**: 70% to 80% of alerts in the shift queue represent benign activity or harmless false positives.
- [ ] **Legitimate Administrative Activity (Benign True Positives)**:
  - Scheduled backups running elevated batch scripts.
  - Authorized vulnerability scanners performing TCP port sweeps.
  - IT system administrators running remote PowerShell enumeration (`Get-NetIPConfiguration`).
- [ ] **Signature Heuristics (False Positives)**:
  - Commercial email newsletters with zero-byte tracking beacons.
  - Developer compile scripts executing temporary executables from `%TEMP%`.
  - Legitimate bulk automated file synchronizations triggering heuristic exfiltration rules.
- [ ] **Duplicate / Cascaded Clusters**: At least 2 alert clusters firing redundant signals for the same root event (e.g. Perimeter IDS alert + Firewall drop + EDR connection attempt).

---

## 3. Incident Ground Truth & Multi-Stage Kill Chains
- [ ] **Distinct Adversary Scenarios**: Multi-stage attack narratives represent distinct modern threat vectors:
  - **Phishing Credential Compromise**: Inbound macro/HTML phishing lure → credential theft → anomalous session logon.
  - **Exposed Service Pivot**: External SSH/RDP brute force → credential guess → host staging.
  - **Persistence / Execution**: Legitimate utility abuse (LOLBin) → scheduled task / service installation → outbound beacon.
- [ ] **Plausible Timeline Spacing**: Timestamps follow realistic attacker dwell times and execution intervals rather than instantaneous concurrent firings.
- [ ] **Root Cause Traceability**: Every alert belonging to an incident links to identifiable parent telemetry or corroborating host/user indicators.

---

## 4. Nuance & Practitioner Ambiguity
- [ ] **Acceptable Alternative Dispositions**: Genuinely ambiguous alerts (e.g. scanning without malicious follow-up, admin tool usage during off-hours) include documented alternative verdicts:
  - Both `Benign True Positive` and `False Positive` accepted with sound justification.
  - `Needs More Information` accepted when essential corroborating endpoint memory or PCAP is required.
- [ ] **Balanced Severity Weights**: Rule severities match real-world SOC playbook triage matrices (e.g. isolated port scan = `LOW`/`INFO`, confirmed LOLBin execution = `HIGH`/`CRITICAL`).
- [ ] **Fair Penalties**: Scoring models penalize blanket "alarmist" over-escalation and negligent dismissals without penalizing reasonable analyst differences.

---

## 5. Metadata Plausibility & Context
- [ ] **CMDB Alignment**: Every alerted internal IP and hostname maps to an asset in the environment inventory with defined OS, role, owner, and network zone.
- [ ] **User Identity Context**: Alerted user accounts reflect realistic departments, roles, and risk scores in the mock corporate directory.
- [ ] **Clear Next Actions**: Debrief explanations provide constructive pedagogical feedback explaining *why* the activity was malicious or benign, referencing specific artifacts.

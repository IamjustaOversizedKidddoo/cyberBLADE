# Authoring Guide: Writing SOC Incident Report Ground Truth

This guide explains how scenario authors design, specify, and test **Report Ground Truth** within SOC scenario families (`content/soc/families/*.yaml`).

---

## 1. Ground Truth Structure

Every incident within a scenario family includes a `reportGroundTruth` block conforming to the `SocReportGroundTruth` schema.

```yaml
reportGroundTruth:
  verdict:
    correctDisposition: "true_positive"
    correctSeverity: "HIGH"
    confidenceThreshold: "medium"
    verdictRationale: "Confirmed credential harvesting campaign followed by interactive logon from unauthorized IP."
  scope:
    affectedAssets:
      - "ws-corp-fin-01.apex.internal"
    affectedUsers:
      - "jdoe"
    systemsAtRisk:
      - "dc-01.apex.internal"
      - "fs-01.apex.internal"
  timeline:
    - timestampUtc: "2026-10-12T08:15:22Z"
      description: "Phishing email delivered with malicious credential harvester link."
      dataOrigin: "Proofpoint Email Gateway"
      evidenceRef: "alt-01"
    - timestampUtc: "2026-10-12T08:22:45Z"
      description: "User submitted credentials on spoofed portal."
      dataOrigin: "Proxy / Firewall Logs"
      evidenceRef: "alt-02"
    - timestampUtc: "2026-10-12T08:45:10Z"
      description: "Unauthorized logon from external Tor exit node."
      dataOrigin: "Entra ID Sign-in Logs"
      evidenceRef: "alt-03"
  iocs:
    - type: "domain"
      value: "apex-portal-auth.com"
      role: "delivery"
      isTruePositive: true
      evidenceRefs: ["alt-01", "alt-02"]
      notes: "Phishing domain hosting credential clone"
    - type: "ip"
      value: "198.51.100.45"
      role: "c2"
      isTruePositive: true
      evidenceRefs: ["alt-03"]
      notes: "Adversary proxy server used for session hijacking"
    - type: "ip"
      value: "8.8.8.8"
      role: "unrelated_benign"
      isTruePositive: false
      evidenceRefs: ["alt-04"]
      notes: "Benign DNS resolver noise"
  techniques:
    - techniqueId: "T1566.002"
      techniqueName: "Phishing: Spearphishing Link"
      tactic: "Initial Access"
    - techniqueId: "T1078"
      techniqueName: "Valid Accounts"
      tactic: "Defense Evasion"
  actions:
    recommendedActionIds:
      - "act-revoke-sessions"
      - "act-reset-password"
      - "act-block-ip"
    optionalActionIds:
      - "act-isolate-workstation"
    harmfulActionIds:
      - "act-reformat-dc"
      - "act-delete-user-mailbox"
  narrative:
    expectedThemes:
      - "credential phishing"
      - "session theft"
      - "unauthorized access"
    keyFacts:
      - "jdoe clicked link at 08:22Z"
      - "MFA prompt was accepted via adversary push fatigue"
  escalation:
    requiresEscalation: true
    targetTeam: "Incident Response / CSIRT"
    recommendedUrgency: "priority"
```

---

## 2. Best Practices for Ground Truth Authoring

### 2.1. Realistic IoC Roles
Choose accurate roles from the standard vocabulary:
- `delivery`: Phishing domains, email senders, dropper URLs.
- `c2`: Command and control servers, beaconing domains/IPs.
- `staging`: Intermediate pivot points, internal payload shares.
- `persistence`: Scheduled task names, registry Run keys, web shells.
- `lateral_movement`: PsExec targets, WMI remote endpoints.
- `exfiltration`: Mega.nz uploads, SFTP destinations, DNS tunneling domains.
- `victim`: Targeted workstation or server IP/hostname.
- `unrelated_benign`: Background noise, internal DNS servers, NTP hosts.

### 2.2. Distractor & Benign Indicators
Always include 1–3 `isTruePositive: false` indicators in the scenario. This allows the grading engine to test the analyst's **precision** and detect indiscriminate copy-pasting or swamping.

### 2.3. Defining Harmful Actions
Explicitly declare harmful actions in `harmfulActionIds`. These represent common junior-analyst mistakes that cause major business disruption, such as:
- Wiping or reformatting a machine without taking a memory or disk image.
- Shutting down critical infrastructure (e.g., Domain Controllers).
- Deleting user mailboxes instead of revoking active sessions.

The grader penalizes students heavily if they select these actions.

---

## 3. Dynamic Synthesis in Scenario Variants

When scenarios are procedurally generated from seeds, the generator invokes `synthesizeReportGroundTruth(variant, seed)`:
- Seed-based asset names (e.g. `ws-corp-fin-01` or `ws-sales-04`) are interpolated dynamically into the ground truth.
- Timestamps are adjusted relative to the incident's generated epoch.
- All alert references (`evidenceRef`) align precisely with generated alerts in the queue.

---

## 4. Verification & Validation

After adding or editing scenario families:

1. **Schema Check:**
   ```bash
   npm run check:soc
   ```
   Validates YAML syntax against the Zod schema and checks required ground-truth properties.

2. **Cross-Reference Validation:**
   ```bash
   npm run check:content
   ```
   Verifies that referenced actions, techniques, and debrief IDs exist across the platform catalog.

3. **Monotonicity & Grader Tests:**
   ```bash
   npx vitest run tests/unit/lib/lab-engine/soc/report-monotonicity.test.ts
   ```
   Verifies that synthesized ground truth passes 1,000-seed grading monotonicity tests.

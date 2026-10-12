# Authoring Guide: Procedural SOC Scenario Families

This guide walks security content authors and instructional designers through creating, calibrating, and validating new **Scenario Families** (`SocFamily`) in the CyberBLADE SOC simulator.

A scenario family is not a static scenario—it is a **declarative procedural blueprint** capable of deterministically generating thousands of distinct, valid, solvable, non-leaky, and anti-tell-hardened investigation shifts.

---

## 1. Directory Structure & Conventions

```
content/soc/
├── vocab/                         # Shared synthetic vocabularies (RFC 5737 IPs, reserved domains)
│   ├── organizations.yaml         # Sector archetypes, domains, working hours
│   ├── assets.yaml                # Role-based host naming schemes
│   ├── users.yaml                 # Realistic user pools by department
│   ├── iocs.yaml                  # Reserved attacker IPs, malicious domains, file hashes
│   └── benign-catalog.yaml        # Benign utilities, cloud sync tools, admin tools
├── families/                      # Declarative family YAML blueprints
│   ├── soc-f-mixed-signal-01.yaml # L1 reference family
│   └── ...
└── family.schema.json             # JSON Schema for editor intellisense
```

---

## 2. Step-by-Step Authoring Workflow

### Step 1: Define Family Metadata
Create a new file `content/soc/families/<family-id>.yaml`.

```yaml
metadata:
  id: soc-f-ransomware-triage-01
  version: 1
  title: "L2 Intermediate: Fast-Moving Ransomware Triage"
  level: "L2"
  skillsTested:
    - soc.alert_triage
    - soc.evidence_linking
    - soc.containment_timing
  estimatedMinutes: 25
  difficultyRange:
    min: 2
    max: 5
  author: "CyberBLADE Blue Team Engineering"
  reviewStatus: "draft" # draft | practitioner-reviewed | approved
  reviewerNotes: "Initial draft modeled around living-off-the-land lateral movement."
```

### Step 2: Configure Environment Archetypes
Define which organizational archetypes and roles can be sampled.

```yaml
environment:
  sectorArchetypes: ["financial", "healthcare", "technology"]
  workstationCountRange: [20, 60]
  serverCountRange: [4, 12]
  workingHours:
    start: 8
    end: 18
  timeZones: ["UTC", "America/New_York", "Europe/London"]
```

### Step 3: Design Attack Chains (Incident Templates)
Each incident template specifies an ordered chain of stages leading to a security verdict.

```yaml
incidentTemplates:
  - id: inc-credential-harvest
    titleTemplate: "Phishing Credential Access against {targetUser}"
    severity: "CRITICAL"
    verdict: "true_positive"
    rootCauseCategory: "phishing"
    descriptionTemplate: "Targeted spearphishing leading to credential harvesting and mailbox forwarding rules."
    stages:
      - id: stage-delivery
        name: "Inbound Malicious Attachment"
        timingOffsetMinutes: -45
        generatesAlert: true
        alertTemplate:
          title: "Malicious Attachment Detected"
          severity: "HIGH"
          sensor: "proofpoint-email-gateway"
          summaryTemplate: "Inbound message to {targetUser} contained macro-enabled attachment from untrusted domain."
          rawFields:
            sourceIp: "{attackerIp}"
            sender: "billing-update@external-verify.example"
            recipient: "{targetUserEmail}"
            attachment: "Invoice_Review_{date}.xlsm"
```

#### Vital Rules for Incident Stages:
1. **Parameterized Tokens**: Always use `{targetHost}`, `{targetUser}`, `{attackerIp}`, `{c2Domain}`, etc.
2. **Timing Jitter & Queuing**: Ensure stages have realistic relative offsets (`timingOffsetMinutes`).
3. **Detection Gaps**: In higher difficulty settings, flag non-critical stages with `optional: true` or `generatesAlert: false` to force learners to correlate from underlying telemetry rather than relying on automated sensor alerts.

### Step 4: Author Benign Noise Templates
Realistic SOC queues contain heavy operational noise. Every family must include at least 6 diverse benign templates.

```yaml
benignTemplates:
  - id: b-backup-sync
    name: "Nightly Automated Backup"
    frequencyDistribution: "hourly"
    typicalHourRange: [1, 5]
    generatesAlert: true
    alertTemplate:
      title: "Elevated Volume Data Transmission"
      sensor: "suricata-nids"
      severity: "MEDIUM"
      summaryTemplate: "High volume data backup job initiated by service account {backupUser} to designated storage cluster."
      rawFields:
        user: "{backupUser}"
        bytesSent: "849204820"
        destinationHost: "storage-cluster-01.corp.internal"
```

### Step 5: Construct Twin Lookalike Templates
To test analyst discrimination, create paired twins where a benign operational event mirrors an attack technique.

```yaml
twinTemplates:
  - id: twin-powershell-b64
    name: "Encoded PowerShell Execution"
    maliciousTemplateId: "inc-ps-c2"
    benignTemplateId: "b-powershell-sccm"
    discriminatingFactors:
      - "Parent process: explorer.exe vs ccmexec.exe"
      - "Command payload: web download cradle vs local asset inventory script"
      - "User identity: standard corporate user vs SYSTEM / SCCM service account"
    acceptableDispositions:
      malicious: ["true_positive"]
      benign: ["benign_true_positive", "false_positive"]
```

---

## 3. Anti-Tell Engineering Checklist

Accidental generator artifacts ("tells") destroy training fidelity by letting learners or machine learning models distinguish malicious alerts from noise without analyzing the evidence. The validation toolchain enforces strict invariance thresholds ($\le 72\%$ balanced accuracy).

| Check | Failure Cause | Correct Design Pattern |
| :--- | :--- | :--- |
| **Field Count Invariance** | Malicious alerts have 4 fields while noise has 2. | Maintain 3–4 fields across **both** malicious and benign alert templates. |
| **Summary Length Invariance** | Malicious summaries are long explanations while noise is brief. | Keep character counts balanced (~110–135 characters across all templates). |
| **Queue Position Uniformity** | Batch noise clumps before minute 0 while attacks arrive after. | Use negative and positive timing offsets evenly across both attack stages and benign operations. |
| **Severity Calibration** | Real sensors are noisy! If all benign alerts are LOW and all attacks are HIGH, learners simply sort by severity. | Calibrate benign alerts with HIGH/MEDIUM sensor severities (e.g., vulnerability scanners or backup bursts). |
| **ID & Entity Opaque Format** | Using prefixes like `TP-ALERT-01` or sequential counters. | Use cryptographically random, uniform opaque identifiers (`alt-0a1b2c3d`). |

---

## 4. Running the Validation & Proof Toolchain

Never submit a family without running the automated proof toolchain.

### 1. Fast Syntax & Schema Check
```bash
npm run check:soc:families -- --seeds 50
```

### 2. Inspect a Generated Scenario Variant
Inspect both the client projection and server ground truth in a safe temp folder:
```bash
npm run soc:gen -- --family soc-f-ransomware-triage-01 --seed 42 --difficulty intermediate --out .temp/soc-sample
```

### 3. Generate Full 1,000-Seed Mathematical Proof Report
```bash
npm run soc:family-report -- --family soc-f-ransomware-triage-01 --seeds 1000
```
This evaluates 3,000 scenario variants across Beginner, Intermediate, and Advanced profiles, verifying:
- **100% Structural & Semantic Pass**
- **100% Zero-Leak Client Projection**
- **Reference Solver Accuracy $\ge 75\%$**
- **Adversarial Naive Solver Ceilings $\le 70\%$**
- **Discretion Margin $\ge +15\%$**
- **Pairwise Distance $\ge 0.20$**
- **Generation Time p95 $< 100$ ms**

---

## 5. Review & Publication Gates

1. **Draft Stage**: Author writes family YAML and satisfies `npm run check:soc:families`.
2. **Practitioner Review**: A practicing SOC analyst conducts peer review against `docs/dev/soc-practitioner-review.md`.
3. **Approval**: Review status is set to `approved` in YAML. The file content hash is locked in CI. Any subsequent edits require a version increment (`version: 2`).

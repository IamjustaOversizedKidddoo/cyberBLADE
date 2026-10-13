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
### Step 5: Construct Twin Lookalike Templates ("Twins")
To test analyst discrimination and critical thinking, create paired twins where a benign operational event mirrors an attack technique.
A good twin satisfies **Observational Symmetry**:
1. **Identical Sensor & Event Type**: Both alerts come from the same detection tool (e.g., EDR, WAF, Mail Gateway).
2. **Surface Lookalike Payload**: The benign payload looks superficially alarming (e.g., base64 PowerShell, automated database dump, admin curl request).
3. **Forensic Discrepancy**: The ground truth diverges based on specific contextual signals:
   - Parent process lineage (`ccmexec.exe` vs `word.exe`)
   - User account context (`svc-backup` vs interactive employee user)
   - Destination address / endpoint legitimacy (`corp.internal` vs untrusted external IP)
   - Time of execution relative to approved maintenance windows

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

## 3. Anti-Tell Engineering & Practitioner Lessons Learned

Accidental generator artifacts ("tells") destroy training fidelity by letting learners or naive heuristics distinguish malicious alerts from noise without analyzing the evidence. The validation toolchain enforces strict invariance thresholds ($\le 72\%$ balanced accuracy).

### Key Authoring Lessons:
1. **Summary Length Envelope (110–140 chars)**: The length tell detector flags alerts if malicious alert summaries are systematically longer or shorter than benign alerts. Always compose template summaries within a tight length band (~110–135 characters).
2. **Matching Raw Field Counts & Keys**: If attack alerts include `commandLine`, `parentProcess`, and `hash`, but benign alerts only have `user` and `host`, a simple field-count heuristic can score 90%+. Ensure benign alerts populate realistic matching fields.
3. **Realistic Sensor Noise (Severity Calibration)**: Real enterprise sensors generate false positives at `HIGH` and `MEDIUM` severities (e.g., vulnerability scans, mass backup syncs, admin script bursts). If all benign alerts are `LOW`, learners trivially filter by severity.
4. **No Keyword Tells**: Never use words like "malicious", "exploit", or "attacker" in alert summaries unless real sensors emit those exact strings (and ensure benign alerts also use operational alert phrases like "suspicious activity detected").
5. **RFC 5737 and Domain Enforcement**: Never use live public IPs, real corporate brand names, or active malware hashes.
   - External IPs must be sampled exclusively from RFC 5737 blocks: `192.0.2.0/24` (TEST-NET-1), `198.51.100.0/24` (TEST-NET-2), or `203.0.113.0/24` (TEST-NET-3).
   - Internal domains must end in `.corp.internal`, `.test`, or `.example`.

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
npm run soc:gen -- --family soc-f-phishing-cred-01 --seed 42 --difficulty intermediate --out .temp/soc-sample
```

### 3. Generate HTML Review Packs for Human Analysts
Generate interactive HTML review packs with queue tables, raw event logs, and answer keys:
```bash
npm run soc:review-pack -- --family soc-f-phishing-cred-01 --count 3 --out .temp/review-packs
```

### 4. Planted Flaw Sensitivity Testing
Before approving a family, verify that the proof toolchain catches injected flaws:
```bash
npx vitest run tests/unit/lib/lab-engine/soc/planted-flaws.test.ts
```
This suite verifies that if a family is mutated to have missing fields, ground-truth leaks, length tells, or broken logic, the validation toolchain immediately fails.

### 5. Benchmark Performance
Verify scenario generation executes within the 150ms latency budget:
```bash
npx tsx scripts/soc-library-benchmark.mts
```

---

---

## 5. Review & Publication Gates

1. **Draft Stage**: Author writes family YAML with `reviewStatus: "draft"` and `published: false`. Automated proof tests and planted flaw suite pass.
2. **Practitioner Review**: A practicing SOC analyst inspects generated review packs, audits realism against `docs/dev/soc-practitioner-review.md`, and adds sign-off notes in `reviewerNotes`.
3. **Approval & Publication**: Status transitions to `reviewStatus: "approved"`. Once curriculum readiness is achieved, `published: true` is set.

---

## 6. Enrichment & Evidence Layer Authoring (Phase 3 Prompt 4)

When authoring or expanding scenario families, simulated enrichment tools (Reputation, WHOIS, pDNS, Email Headers, URL Analysis, Sandbox Detonation, PCAP/Flows, Endpoint Timelines, CMDB, and ServiceDesk Tickets) generate consistent evidence from the hidden scenario state.

### 1. Declaring Entity Roles
Entities in families map to canonical roles:
- `attacker_infra`: Adversary C2 servers, phishing delivery domains, dropper hashes. Sources simulate ~15–20% false negatives (unknown to some feeds) and high scores elsewhere.
- `victim`: Targeted user endpoints and accounts. Timelines reflect process execution and credential misuse; CMDB reflects valid business identity.
- `benign_business`: Authorized internal servers, routine user activity. Sources simulate ~3–12% false positives (heuristic warnings) and low baseline scores.
- `shared_infra`: Multi-tenant cloud providers, CDNs, dynamic cloud storage. Induces natural reputation ambiguity and mixed-source disagreements.
- `scanner`: Authorized internal or external vulnerability scanners. Corroborated by ServiceDesk pen-test notices.

### 2. Zero-Network Synthetic Artifact Rules
- **Domains**: Strictly use reserved RFC domains: `.example`, `.test`, `.invalid`, or `.corp.internal`. Never use registered external domains.
- **IPs**: Strictly use RFC 5737 documentation blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Hashes & Files**: Abstract, inert payloads with realistic SHA-256 formatting. Never reference live malware hashes, active C2 hosts, or operational exploits.

### 3. Anti-Tell & Symmetry Mandates
- **Field Shape Invariance**: Malicious and benign indicators return identical JSON schemas. No tool output may introduce unique fields (e.g. `isMalicious: true`) that leak role by presence.
- **Latency Clamping**: Server execution clamps latency to a uniform window (35–55ms) to prevent side-channel timing attacks.
- **Imperfect Truth Enforcement**: No single tool yields a 100% decisive verdict. Analysts must correlate at least two corroborating signals (e.g., header authentication failure + pDNS domain history) before drawing conclusions.

---

## 7. Investigation Dataset & Query Questions (Phase 3 Prompt 5)

Scenario variants automatically produce high-fidelity synthetic log lakes (5,000–60,000 events) indexed across telemetry sources.

### 1. Telemetry Stream Coverage
Every family incorporates events across 9 primary streams:
- `auth`: Interactive and network logon telemetry (EventCode 4624/4625, Kerberos/NTLM).
- `firewall`: Egress/ingress flow logs with byte counters and stateful permit/deny actions.
- `endpoint`: Process creation events (EventCode 4688) with parent process hierarchies and command lines.
- `dns`: Internal resolver resolution streams with query types and response codes.
- `proxy`: HTTP/HTTPS egress connections with URLs, status codes, and user-agent strings.

### 2. Writing Investigation Question Templates
When extending families with SAL1/BTL1-style questions:
1. **Neutral Stems Only**: Ensure questions do not predetermine guilt or reveal attacker presence.
2. **Deterministic Answerability**: Formulate a reference query in BladeQL that extracts the exact answer from client-visible fields.
3. **Anti-Guessing Distractors**: Choice options must be sampled directly from real event values in the variant rather than hardcoded dummy values.
4. **Leak-Free Hint Tiers**: Provide 2–3 tiered hints guiding analysts to appropriate sources and operators without revealing entity names.



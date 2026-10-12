# SOC Practitioner Review Guide

This guide is designed for **working Tier 1–3 Security Operations Analysts, Incident Responders, and Detection Engineers** performing peer review on procedural scenario families in CyberBLADE.

Your mission during practitioner review is not to check syntax—the automated test suite already guarantees mathematical solvability and code correctness. Your role is **operational realism and training authenticity**: ensuring that our generated shifts feel indistinguishable from a real-world enterprise SOC.

---

## 1. Quick Start: Generating Review Samples

You do not need programming knowledge. Run the following command from the repository root:

```bash
# Generate 3 distinct review samples across different difficulties
npm run soc:gen -- --family soc-f-mixed-signal-01 --seed 101 --difficulty beginner --out .temp/review-beginner
npm run soc:gen -- --family soc-f-mixed-signal-01 --seed 202 --difficulty intermediate --out .temp/review-intermediate
npm run soc:gen -- --family soc-f-mixed-signal-01 --seed 303 --difficulty advanced --out .temp/review-advanced
```

In each output directory, inspect:
- `client-view.json`: Exactly what the Tier 1 analyst sees in their queue, raw event logs, and case workspace.
- `ground-truth.json`: The authoritative ground truth, incident explanations, and scoring rubric.

To inspect the automated 1,000-seed mathematical proof:
```bash
npm run soc:family-report -- --family soc-f-mixed-signal-01 --seeds 1000
```
Open `docs/generated/soc-family-report-soc-f-mixed-signal-01.md`.

---

## 2. Practitioner Realism Checklist

When reviewing sample variants, evaluate against these four operational pillars:

### 1. Alert Calibration & Sensor Authenticity
- [ ] **Sensor Realism**: Do alert titles match typical detections from standard security tools (e.g., CrowdStrike Falcon, Microsoft Defender for Endpoint, Suricata, Palo Alto PAN-OS, Proofpoint)?
- [ ] **Severity Mismatch / Noise Calibration**: Are some benign operational alerts rated `HIGH` or `CRITICAL` by noisy sensors (e.g., Nessus vulnerability scans or large nightly backup transfers)? *If every benign alert is LOW, the scenario lacks realistic alert fatigue.*
- [ ] **Summary & Log Naturalism**: Does the summary read like real detection telemetry rather than a contrived riddle?

### 2. Attack Chain Plausibility & Threat Realism
- [ ] **TTP Continuity**: Does the attack flow follow a credible attacker lifecycle (e.g., Initial Access $\rightarrow$ Execution $\rightarrow$ Persistence $\rightarrow$ C2)?
- [ ] **Timeline Credibility**: Are the timestamp offsets plausible? (e.g., Brute force occurring overnight; C2 beacons establishing within minutes of macro execution; admin maintenance occurring in approved batch windows).
- [ ] **Telemetry Gaps**: In Intermediate and Advanced shifts, are detection gaps fair? (e.g., EDR alert didn't fire, but the process execution is clearly visible in endpoint event logs).

### 3. Lookalikes & Discretion Testing ("Twins")
- [ ] **Administrative Lookalikes**: Do the benign twins use genuine administrative tools (e.g., SCCM, PsExec for scheduled updates, PowerShell inventory scripts)?
- [ ] **Investigative Contrast**: Is there sufficient evidence in the raw logs for a careful analyst to separate authorized IT admin activity from an adversary living off the land?

### 4. Debrief Technical Accuracy
- [ ] **Teaching Value**: Does the debrief clearly explain *why* an alert was true positive or benign?
- [ ] **Operational Guidance**: Does the debrief suggest industry-standard follow-ups (e.g., host isolation, credential revocation, firewall block requests, mailbox forwarding rule audit)?

---

## 5. Review Workflow & Status Lifecycle

1. **`draft`**: The author has written the family blueprint and automated proof tests pass.
2. **`practitioner-reviewed`**: At least one working SOC analyst has inspected variants, confirmed operational realism, and documented feedback in the `reviewerNotes` field of the family YAML.
3. **`approved`**: The family meets all realism and difficulty criteria. The family version is locked and published into the active training rotation.

### Recording Feedback
In `content/soc/families/<family-id>.yaml`:
```yaml
metadata:
  reviewStatus: "practitioner-reviewed"
  reviewerNotes: "Reviewed seeds 101, 202, 303. Verified brute-force timing and SCCM twin plausibility. Calibrated CrowdStrike alert titles to better reflect Falcon sensor alerts."
```

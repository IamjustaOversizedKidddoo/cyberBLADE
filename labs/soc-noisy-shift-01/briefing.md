# Operational Briefing: Morning Shift at Apex Global Logistics

You are reporting for a morning shift as the Tier-1 Security Operations Center (SOC) analyst for **Apex Global Logistics**.

### Situational Context
The security information and event queue contains **48 unworked alerts** accumulated over the last two hours across endpoint EDR, perimeter network IDS, inbound email gateways, and corporate directory authentication sensors.

In a real enterprise operations center, **70% to 80% of all generated alerts are benign noise**:
- Routine IT administrative scripts
- Scheduled vulnerability scanners
- Antivirus signature heuristics on legitimate developer code
- Benign commercial email marketing beacons

However, buried within this telemetry noise are **active adversary incidents** attempting to compromise corporate assets.

---

### Your Mission
1. **Work the Alert Queue**: Review incoming telemetry, examine raw event attributes, and inspect asset criticality in the asset inventory.
2. **Assign Triage Dispositions**:
   - `True Positive`: Genuine malicious adversary actions.
   - `False Positive`: Benign activity misidentified by signature logic.
   - `Benign True Positive`: Detection triggered accurately, but activity is authorized/expected maintenance.
   - `Duplicate / Related`: Redundant cascaded alert belonging to an existing incident.
   - `Needs More Information`: Inconclusive data requiring endpoint isolation or secondary capture.
3. **Escalate True Incidents**: Flag verified intrusions for Tier-2 / Incident Response escalation with clear evidence and technical rationale.
4. **Group Incident Cases**: Correlate multi-stage attacks into organized cases with timestamped investigation notes.
5. **Submit Shift Evaluation**: Conclude your shift to receive an authoritative, server-evaluated scorecard and expert debrief.

---

### Technical Controls & Rules of Engagement
- **Keyboard Shortcuts**: Press `?` in the workspace to view speed controls (`j`/`k` to navigate, `Enter` to open, `d` to triage, `/` to search).
- **Integrity Guarantee**: Evaluator scoring rewards precision and penalizes alarmist blanket escalations as heavily as negligent dismissals.

# Operation Phantom Probe: Security Incident & Event Triage

### Situation Briefing

An intrusion alert fired in the SOC at 08:38 UTC. Automated correlation rules flagged a suspicious login anomaly: a service account with high privileges was authenticated remotely from an untrusted public IP address immediately after repeated failed credential attempts.

Minutes later, an endpoint audit log registered a new persistent Windows service installation, followed by outbound beaconing activity toward an external command-and-control server.

---

### Your Mission

As the Tier-1 Incident Responder on duty, access the **CYBERBLADE SIEM Console** below to triage the event stream and answer the incident inquiry:

1. **Reconnaissance & Origin:** Determine the attacker's public IP address originating the perimeter probe and logon storm.
2. **Targeted Identity:** Identify which account identity was compromised during the credential stuffing attack.
3. **Attack Metrics:** Determine the exact volume of failed logon attempts (Event ID 4625) executed by the adversary before achieving access.
4. **Persistence Mechanism:** Inspect Event ID 7045 (Service Installation) to discover the malicious persistence binary deployed on the system.
5. **C2 Payload Extraction:** Extract the command-and-control authorization flag (`FLAG{...}`) embedded inside the service launch parameters.

---

### Console Capabilities

- **Search Bar:** Type keywords (e.g. `4625`, `7045`, or an IP address) to instantly filter events.
- **Severity Filters:** Toggle `CRITICAL`, `HIGH`, or `MEDIUM` to focus on priority alerts.
- **Event Inspector:** Click any event in the table to display extracted security attributes and verbatim raw audit lines.
- **Clipboard:** Use the *Copy Raw* utility to capture forensic strings for your report.

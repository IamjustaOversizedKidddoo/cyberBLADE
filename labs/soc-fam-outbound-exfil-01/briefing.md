# Scenario Practice: Outbound Egress & DNS Exfiltration

Covers network perimeter telemetry, forward proxy logs, and DNS server queries to identify C2 communication channels and bulk data exfiltration.

### Learning Goals
- Recognize DNS tunneling characterized by high query volume, subdomains containing base64/hex payloads, and abnormal query lengths.
- Detect periodic HTTP/HTTPS callbacks with fixed sleep jitter indicating beaconing behavior.
- Validate authorized corporate backup synchronization vs unapproved file staging.

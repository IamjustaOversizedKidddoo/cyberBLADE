# Scenario Practice: Attachment to Script Execution & Persistence

Simulates an endpoint intrusion chain initiated via weaponized email attachments, leading to script interpreter execution and scheduled task persistence.

### Learning Goals
- Correlate inbound mail attachments with host-level process creation logs (Event ID 4688).
- Analyze suspicious process parentage (e.g. word processor or PDF viewer spawning PowerShell with encoded commands).
- Inspect scheduled task and service installation indicators.

# Operation Iron Gate: Rank 1 Capstone Challenge

## Emergency Dispatch
The Security Operations Center has triggered an emergency priority alert. An intrusion detection sensor detected anomalous outbound beaconing from a key enterprise host, and preliminary telemetry indicates unauthorized access was obtained followed by persistence installation.

As the Senior Incident Responder, you have been deployed to investigate the compromised host. You have 30 minutes to complete the triage investigation, identify the attack vectors, and secure the containment flag.

## Mission Tasks
1. **Exfiltration IP**: Extract the external destination IP address from the network triage report (`~/Triage/incident-report.txt`).
2. **C2 Domain**: Identify the domain name queried via DNS in the triage log.
3. **Autostart Persistence**: Query the Windows Registry (`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`) to isolate the unauthorized persistence entry.
4. **Compromised Identity**: Inspect the Security event log (`Get-WinEvent`) to pinpoint the user account compromised via external authentication.
5. **Incident Flag**: Retrieve the containment verification flag from `HKLM:\SOFTWARE\CyberBlade\Verification`.

## Rules of Engagement
- **Time Limit:** 30 minutes. If the clock runs out, your attempt expires and a 30-minute cooldown applies.
- **Tools:** Use PowerShell cmdlets (`Get-ItemProperty`, `Get-WinEvent`, `Select-String`, `cat`, etc.) in the terminal.
- **Passing Criterion:** Submit all 5 objectives correctly to earn 400 XP and achieve promotion to **Rank 2: Watcher**.

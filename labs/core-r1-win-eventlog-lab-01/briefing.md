# Event Log Forensics: Brute Force & Rogue Service

## Situation Report
The Security Operations Center (SOC) detected an authentication anomaly originating from an internal host followed by service modifications. As the Tier-1 responder, you must investigate the host's Windows Event Logs using PowerShell cmdlets (`Get-WinEvent`, `Select-String`).

Determine whether an adversary conducted a password brute-force attack, identify the compromised account and source IP address, and confirm whether persistence was achieved through rogue service installation.

## Mission Objectives
1. **Failure Event ID**: Provide the canonical Windows Security Event ID for failed logon attempts.
2. **Victim Account**: Identify the target user account targeted by the brute-force attempt.
3. **Attacker IP**: Identify the originating IP address of the malicious authentication requests.
4. **Installed Service**: Locate Event ID 7045 in the System log to uncover the `ServiceName` of the unauthorized service installation.

## Useful PowerShell Commands
- `Get-WinEvent -LogName Security`
- `Get-WinEvent -LogName Security -Id 4625`
- `Get-WinEvent -LogName System -Id 7045`
- `Get-WinEvent -LogName Security | Select-String "TargetUserName"`

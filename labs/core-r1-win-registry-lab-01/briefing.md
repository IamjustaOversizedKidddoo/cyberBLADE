# Registry Persistence Hunt: Run Keys & Service Binaries

## Situation Report
An endpoint detection alert flagged anomalous activity on a Windows enterprise host. A compromised account may have established persistence by tampering with Windows Registry auto-start locations and service definitions.

Your mission is to perform targeted registry forensics using PowerShell cmdlets (`Get-ItemProperty`, `Get-Item`, or their alias `gp`), uncover the persistence mechanism, locate the dropped malware payloads, and submit your findings.

## Mission Objectives
1. **Rogue Run Key**: Query `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` to identify the unauthorized value name configured by the adversary.
2. **Payload Location**: Identify the full binary path executed by that Run key entry.
3. **Suspicious Service**: Locate the anomalous service installed under `HKLM:\SYSTEM\CurrentControlSet\Services` and record its `ImagePath` executable path.
4. **Verification Flag**: Extract the security audit flag stored under `HKLM:\SOFTWARE\CyberBlade\Audit`.

## Recommended Cmdlets & Syntax
- `Get-ItemProperty HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
- `Get-ItemProperty -Path HKLM:\SOFTWARE\CyberBlade\Audit -Name Flag`
- `gp HKLM:\SYSTEM\CurrentControlSet\Services\<ServiceName>`

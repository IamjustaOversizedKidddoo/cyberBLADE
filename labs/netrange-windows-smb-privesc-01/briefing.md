# Tactical Engagement: Windows SMB Reconnaissance & Service Misconfiguration PrivEsc

## Mission Objective
Your mission is to perform a targeted security assessment against a Windows Server 2019 endpoint (`WIN-SRV01` at `192.0.2.120`), identify sensitive credential exposures in network shares, and elevate privileges to `NT AUTHORITY\SYSTEM` through a misconfigured service path.

## Scope & Target Information
- Attacker Machine: `kali@kali:~$` (`192.0.2.200`)
- Target Host: `192.0.2.120` (`WIN-SRV01`)
- Network Segment: `192.0.2.0/24`

## Phase 1: SMB Share Enumeration & Credential Discovery
1. Perform service port scanning and SMB reconnaissance against `192.0.2.120` using `nmap` and `enum4linux-ng` (or `smbclient`).
2. Identify accessible file shares permitting anonymous or unauthenticated read access.
3. Access the `engineering` share using `smbclient` and retrieve `contractor_notes.txt`.
4. Extract the assigned contractor password and submit Flag 1 (`PENTEST{smb_win_...}`).

## Phase 2: Remote Windows Access & Service Privilege Escalation
1. Authenticate to `WIN-SRV01` using `evil-winrm -i 192.0.2.120 -u contractor -p <password>` or `ssh contractor@192.0.2.120`.
2. Inspect the local system environment, user privileges (`whoami /priv` or `id`), and installed Windows services.
3. Query service configuration using `sc qc ApexBackupSvc` or `wmic service get name,pathname,startmode` to discover the unquoted binary path with spaces executing under the `LocalSystem` account.
4. Trigger the service execution with `sc start ApexBackupSvc` or `net start ApexBackupSvc` to obtain an administrative shell session.
5. Access `C:\Users\Administrator\flag.txt` using `type` and submit Flag 2 (`PENTEST{win_privesc_...}`).

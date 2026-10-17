# Tactical Engagement: Host Foothold & Sudo Privilege Escalation

## Mission Objective
Your task is to conduct an end-to-end host penetration assessment against `apex-srv01` (`192.0.2.50`) in the simulated perimeter subnet `192.0.2.0/24`.

## Scope & Target Information
- Attacker Console: `kali@kali:~$` (`192.0.2.200`)
- Primary Target: `192.0.2.50` (`apex-srv01`)
- Network Segment: `192.0.2.0/24`

## Phase 1: Service Enumeration & Exploitation
1. Scan `192.0.2.50` with `nmap` using service version detection (`-sV`).
2. Identify the software versions of open network services.
3. Query the offline exploit database using `searchsploit` for known vulnerabilities.
4. Launch `msfconsole`, configure the target `RHOSTS`, and trigger the backdoor exploit to gain an initial command shell session.
5. Capture and submit the foothold flag located at `/home/operator/flag.txt`.

## Phase 2: Local Privilege Escalation
1. Interrogate local permissions and available administrative delegations using `sudo -l`.
2. Identify non-standard binaries executable with `NOPASSWD`.
3. Use GTFOBins execution primitives to spawn a root shell.
4. Retrieve and submit the administrative flag from `/root/flag.txt`.

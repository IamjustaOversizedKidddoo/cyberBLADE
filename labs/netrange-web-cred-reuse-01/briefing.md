# Tactical Engagement: Web Reconnaissance & Multi-Host Credential Reuse

## Mission Objective
Assess the DMZ web perimeter to detect sensitive data exposure, extract valid administrative credentials, and move laterally to compromised internal infrastructure.

## Scope & Target Information
- Attacker Console: `kali@kali:~$` (`192.0.2.200`)
- Perimeter Web Host: `192.0.2.80` (`apex-web01`)
- Secondary Internal Server: `192.0.2.90` (`apex-db01`)
- Network Segment: `192.0.2.0/24`

## Phase 1: Web Information Disclosure
1. Sweep the local subnet using `nmap` to discover active web and database nodes.
2. Probe `http://192.0.2.80/` with `curl` to analyze the response headers and HTML body.
3. Discover the unindexed database backup file referenced in source comments (`/backup/db_backup.sql`).
4. Retrieve the SQL dump and obtain the first flag along with credentials for `svc_deploy`.

## Phase 2: Credential Reuse & Lateral Movement
1. Verify if the database server (`192.0.2.90`) exposes remote management services such as SSH (port 22).
2. Attempt credential reuse against `192.0.2.90` using the `svc_deploy` account discovered in the dump.
3. Establish an interactive SSH shell session on `apex-db01`.
4. Read and submit the flag located at `/home/svc_deploy/flag.txt`.

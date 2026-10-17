# Tactical Engagement: Dual-Homed Gateway Pivot & Internal Vault Access

## Mission Objective
Breach a perimeter bastion host, establish network routing across network boundaries, and extract confidential records from an isolated internal vault subnet.

## Scope & Target Information
- Attacker Console: `kali@kali:~$` (`192.0.2.200`)
- Accessible Subnet: `192.0.2.0/24` (DMZ)
- Isolated Internal Subnet: `172.16.50.0/24` (Management Vault)
- Dual-Homed Bastion: `apex-gw01` (`192.0.2.100` / `172.16.50.10`)
- Internal Vault Server: `vault-srv01` (`172.16.50.25`)

## Phase 1: DMZ Gateway Enumeration & Compromise
1. Run `enum4linux` or `smbclient -L //192.0.2.100` against the gateway node.
2. Connect to the `public` SMB share and download `creds.txt` and `network-map.txt`.
3. Capture the gateway flag and note the exposed credentials for `pivotuser`.
4. Inspect the secondary network interface connecting to `172.16.50.0/24`.

## Phase 2: Pivoting & Crown Jewel Extraction
1. Configure an attacker routing rule to forward traffic destined for `172.16.50.0/24` through `192.0.2.100`:
   `route add 172.16.50.0/24 via 192.0.2.100`
2. Test network connectivity to `172.16.50.25` using `ping` or `nmap`.
3. Interrogate the vault HTTP API service running on port 8080 with `curl`.
4. Query `/api/crown_jewel` to capture and submit the final flag.

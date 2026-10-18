# Tactical Engagement: DMZ Web Foothold, Gateway Pivot & Internal Vault Exploitation

## Mission Objective
Execute a multi-stage intrusion starting from an external DMZ web server (`apex-dmz-web01`), recover administrative credentials for a dual-homed router (`apex-gw01`), pivot into an isolated internal subnet (`172.16.50.0/24`), and extract confidential crown jewel assets from an internal vault server (`vault-srv01`).

## Scope & Target Topology
- Attacker Console: `kali@kali:~$` (`192.0.2.200`)
- Perimeter DMZ Host: `192.0.2.60` (`apex-dmz-web01`)
- Dual-Homed Gateway: `192.0.2.100` (DMZ) / `172.16.50.10` (Internal) (`apex-gw01`)
- Isolated Internal Vault: `172.16.50.25` (`vault-srv01`)
- Accessible Subnet from Start: `192.0.2.0/24`

## Phase 1: DMZ Web Reconnaissance & Information Disclosure
1. Sweep `192.0.2.0/24` with `nmap` to discover active web services.
2. Probe `http://192.0.2.60/api/diagnostics` using `curl` to analyze edge infrastructure telemetry.
3. Capture the DMZ flag (Flag 1) and note the disclosed credentials for the bastion router (`pivotuser`).

## Phase 2: Gateway Access & Subnet Discovery
1. Authenticate to `apex-gw01` using `ssh pivotuser@192.0.2.100`.
2. Retrieve the gateway flag from `/home/pivotuser/flag.txt` (Flag 2).
3. Interrogate the network configuration (`ifconfig` or `ip a`) to identify the second network interface (`eth1` bound to `172.16.50.10/24`).

## Phase 3: Lateral Movement, Pivoting & Internal Exploitation
1. Establish routing into `172.16.50.0/24`:
   - Approach A (Kernel Routing): Return to the Kali prompt (`exit`) and execute `ip route add 172.16.50.0/24 via 192.0.2.100`.
   - Approach B (Dynamic SOCKS Forwarding): Execute `ssh -D 1080 -f -N pivotuser@192.0.2.100` and route tools using `proxychains`.
2. Connect to the internal vault API endpoint at `http://172.16.50.25:8080/api/crown_jewel`.
3. Submit the confidential crown jewel flag (Flag 3).

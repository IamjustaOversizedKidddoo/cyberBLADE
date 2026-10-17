import type { GeneratorOutput } from "../index";
import type { Rng } from "../rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

/**
 * Scenario (c): DMZ Compromise -> Routing / Pivot -> Internal Subnet Target
 * - DMZ Subnet: 192.0.2.0/24 (accessible from start)
 * - Internal Subnet: 172.16.50.0/24 (blocked until routed via gateway)
 * - Target 1: 192.0.2.100 / 172.16.50.10 (apex-gw01 dual-homed router)
 * - Target 2: 172.16.50.25 (vault-srv01 internal vault API)
 * - Attack Path:
 *   1. Attacker enumerates SMB on apex-gw01 (192.0.2.100).
 *   2. Smbclient extracts creds.txt leaking credentials and Flag 1 (pivot_gw).
 *   3. Attacker connects via SSH to apex-gw01, examines ifconfig/ip a to see 172.16.50.10/24.
 *   4. Attacker configures route: route add 172.16.50.0/24 via 192.0.2.100.
 *   5. Scans or curls http://172.16.50.25:8080/api/crown_jewel to capture Flag 2 (internal_crown).
 */
export function netrangePivotInternal(
  rng: Rng,
  _params: Record<string, unknown>,
): GeneratorOutput {
  const hexGw = rng.hex(8);
  const hexInternal = rng.hex(8);
  const hexPass = rng.hex(4);

  const flagGw = `PENTEST{pivot_gw_${hexGw}}`;
  const flagInternal = `PENTEST{internal_crown_${hexInternal}}`;
  const pivotPassword = `PivotKey${hexPass}!`;

  const scenario: NetRangeScenario = {
    id: "netrange-pivot-internal",
    title: "DMZ Pivot & Internal Subnet Access",
    description: "Compromise a dual-homed perimeter bastion via misconfigured SMB shares, establish a static pivot route into the isolated internal subnet, and retrieve confidential assets.",
    author: "CyberBLADE PenTest Range",
    subnets: [
      {
        cidr: "192.0.2.0/24",
        name: "Perimeter DMZ",
        accessibleFromStart: true,
      },
      {
        cidr: "172.16.50.0/24",
        name: "Internal Vault Subnet",
        accessibleFromStart: false,
      },
    ],
    pivotRules: [
      {
        targetSubnet: "172.16.50.0/24",
        viaHost: "apex-gw01",
        requiresCompromise: true,
      },
    ],
    hosts: [
      {
        id: "apex-gw01",
        hostname: "apex-gw01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.100",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:d1:e2:f3",
          },
          {
            ip: "172.16.50.10",
            subnet: "172.16.50.0/24",
            mac: "00:50:56:d1:e2:f4",
          },
        ],
        services: [
          {
            port: 22,
            protocol: "tcp",
            name: "ssh",
            version: "OpenSSH 8.2p1 Ubuntu 4ubuntu0.5",
            state: "open",
          },
          {
            port: 445,
            protocol: "tcp",
            name: "microsoft-ds",
            version: "Samba 4.9.5-Debian",
            state: "open",
            smbData: [
              {
                name: "public",
                comment: "Public DMZ engineering share",
                readOnly: true,
                files: {
                  "creds.txt": `User: pivotuser\nPassword: ${pivotPassword}\nNotes: Internal router maintenance login\nFLAG: ${flagGw}\n`,
                  "network-map.txt": "eth0: 192.0.2.100/24 (DMZ)\neth1: 172.16.50.10/24 (INTERNAL_VAULT_NET)\nInternal Vault Server: 172.16.50.25:8080\n",
                },
              },
            ],
          },
        ],
        users: [
          {
            username: "pivotuser",
            password: pivotPassword,
            role: "user",
          },
          {
            username: "root",
            role: "root",
          },
        ],
        filesystem: {
          "/home/pivotuser/flag.txt": {
            content: `${flagGw}\n`,
            owner: "pivotuser",
            permissions: "640",
          },
          "/etc/network/interfaces": {
            content: "iface eth0 inet static\n  address 192.0.2.100/24\niface eth1 inet static\n  address 172.16.50.10/24\n",
            owner: "root",
            permissions: "644",
          },
        },
      },
      {
        id: "vault-srv01",
        hostname: "vault-srv01",
        os: "linux",
        interfaces: [
          {
            ip: "172.16.50.25",
            subnet: "172.16.50.0/24",
            mac: "00:50:56:e4:f5:a6",
          },
        ],
        services: [
          {
            port: 8080,
            protocol: "tcp",
            name: "http-proxy",
            version: "VaultAPI 1.0",
            state: "open",
            httpData: {
              "/": {
                status: 200,
                body: "<!DOCTYPE html><html><head><title>Internal Vault Service</title></head><body><h1>Vault Restricted Area</h1><p>Internal network only. Access /api/crown_jewel for authentication keys.</p></body></html>",
              },
              "/api/crown_jewel": {
                status: 200,
                body: `{\n  "status": "AUTHORIZED",\n  "classification": "TOP_SECRET",\n  "crown_jewel": "${flagInternal}"\n}\n`,
              },
            },
          },
        ],
        users: [
          {
            username: "vaultadmin",
            role: "root",
          },
        ],
        filesystem: {
          "/var/log/vault.log": {
            content: "Vault initialized. Internal endpoints active on port 8080.\n",
            owner: "vaultadmin",
            permissions: "644",
          },
        },
      },
    ],
    flags: [
      {
        id: "flag_gw",
        flag: flagGw,
        hostId: "apex-gw01",
        path: "/home/pivotuser/flag.txt",
        objectiveId: "obj_gateway",
      },
      {
        id: "flag_internal",
        flag: flagInternal,
        hostId: "vault-srv01",
        path: "/api/crown_jewel",
        objectiveId: "obj_internal",
      },
    ],
  };

  return {
    env: {
      kind: "netrange",
      network: {
        scenario,
        attackerIp: "192.0.2.200",
        attackerHostname: "kali",
        initialRoutes: ["192.0.2.0/24"],
      },
    },
    answers: {
      flag_gateway: flagGw,
      flag_internal: flagInternal,
    },
  };
}

import type { GeneratorOutput } from "../index";
import type { Rng } from "../rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

/**
 * Scenario (d): DMZ Web Server -> Discover Internal Subnet -> Gateway Pivot -> Internal Service Exploit (3 hosts)
 * - DMZ Subnet: 192.0.2.0/24 (accessible from start)
 * - Internal Subnet: 172.16.50.0/24 (blocked until routed via gateway)
 * - Host 1: 192.0.2.60 (apex-dmz-web01 perimeter web portal)
 * - Host 2: 192.0.2.100 / 172.16.50.10 (apex-gw01 dual-homed router)
 * - Host 3: 172.16.50.25 (vault-srv01 internal vault API)
 * - Attack Path:
 *   1. Attacker queries DMZ web server (192.0.2.60) at /api/diagnostics.
 *   2. Response discloses gateway node credentials (pivotuser) and Flag 1 (dmz_web).
 *   3. Attacker connects via SSH to apex-gw01 (192.0.2.100), retrieves /home/pivotuser/flag.txt for Flag 2 (pivot_gw).
 *   4. Attacker runs ifconfig / ip route on gateway, discovering the dual-homed eth1 interface (172.16.50.10/24).
 *   5. Attacker establishes routing: ip route add 172.16.50.0/24 via 192.0.2.100 (or ssh -D 1080).
 *   6. Attacker connects to internal vault service at http://172.16.50.25:8080/api/crown_jewel and retrieves Flag 3 (internal_crown).
 */
export function netrangePivotInternal(
  rng: Rng,
  _params: Record<string, unknown>,
): GeneratorOutput {
  const hexDmz = rng.hex(8);
  const hexGw = rng.hex(8);
  const hexInternal = rng.hex(8);
  const hexPass = rng.hex(4);

  const flagDmz = `PENTEST{dmz_web_${hexDmz}}`;
  const flagGw = `PENTEST{pivot_gw_${hexGw}}`;
  const flagInternal = `PENTEST{internal_crown_${hexInternal}}`;
  const pivotPassword = `PivotKey${hexPass}!`;

  const scenario: NetRangeScenario = {
    id: "netrange-pivot-internal",
    title: "DMZ Web Foothold, Gateway Pivot & Internal Vault Exploitation",
    description: "Compromise a DMZ web application, leverage leaked infrastructure credentials to access a dual-homed gateway, pivot into an isolated internal subnet, and retrieve the crown jewel data from an internal vault service.",
    author: "CyberBLADE PenTest Range",
    subnets: [
      {
        cidr: "192.0.2.0/24",
        name: "Perimeter DMZ Subnet",
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
        id: "apex-dmz-web01",
        hostname: "apex-dmz-web01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.60",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:c0:d1:e2",
          },
        ],
        services: [
          {
            port: 80,
            protocol: "tcp",
            name: "http",
            version: "nginx 1.18.0 (Ubuntu)",
            banner: "Server: nginx/1.18.0",
            state: "open",
            httpData: {
              "/": {
                status: 200,
                body: "<!DOCTYPE html><html><head><title>Apex Corporate Edge</title></head><body><h1>Apex Edge Gateway</h1><p>Public diagnostic portal. API available at /api/diagnostics</p></body></html>\n",
              },
              "/api/diagnostics": {
                status: 200,
                body: JSON.stringify(
                  {
                    status: "OPERATIONAL",
                    role: "DMZ Edge Portal",
                    flag: flagDmz,
                    infrastructure: {
                      internal_bastion: "192.0.2.100",
                      bastion_user: "pivotuser",
                      bastion_pass: pivotPassword,
                      notes: "Connect via SSH to apex-gw01 for maintenance.",
                    },
                  },
                  null,
                  2,
                ) + "\n",
              },
            },
          },
        ],
        users: [
          {
            username: "www-data",
            role: "user",
          },
        ],
        filesystem: {
          "/var/www/html/flag.txt": {
            content: `${flagDmz}\n`,
            owner: "www-data",
          },
        },
      },
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
                body: "<!DOCTYPE html><html><head><title>Internal Vault Service</title></head><body><h1>Vault Restricted Area</h1><p>Internal network only. Access /api/crown_jewel for authentication keys.</p></body></html>\n",
              },
              "/api/crown_jewel": {
                status: 200,
                body: JSON.stringify(
                  {
                    status: "AUTHORIZED",
                    classification: "TOP_SECRET",
                    crown_jewel: flagInternal,
                  },
                  null,
                  2,
                ) + "\n",
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
        id: "flag_dmz",
        flag: flagDmz,
        hostId: "apex-dmz-web01",
        path: "/api/diagnostics",
        objectiveId: "obj_dmz",
      },
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
    randomizationPoints: {
      pivotPassword,
      hexDmz,
      hexGw,
      hexInternal,
    },
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
      flag_dmz: flagDmz,
      flag_gateway: flagGw,
      flag_internal: flagInternal,
    },
  };
}

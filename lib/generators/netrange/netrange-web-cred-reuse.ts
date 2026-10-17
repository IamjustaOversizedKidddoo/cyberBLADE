import type { GeneratorOutput } from "../index";
import type { Rng } from "../rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

/**
 * Scenario (b): Web information disclosure -> credential reuse -> second host compromise
 * - Target 1: 192.0.2.80 (apex-web01)
 * - Target 2: 192.0.2.90 (apex-db01)
 * - Attack Path:
 *   1. Attacker discovers apex-web01 on 192.0.2.80 running web server on port 80.
 *   2. Curl or web inspection reveals backup dump at /backup/db_backup.sql.
 *   3. Backup file leaks svc_deploy credentials and Flag 1 (web_cred).
 *   4. Attacker performs credential reuse: connects via SSH to apex-db01 (192.0.2.90).
 *   5. Reading /home/svc_deploy/flag.txt reveals Flag 2 (cred_reuse).
 */
export function netrangeWebCredReuse(
  rng: Rng,
  _params: Record<string, unknown>,
): GeneratorOutput {
  const hexWeb = rng.hex(8);
  const hexCred = rng.hex(8);
  const hexPass = rng.hex(4);

  const flagWeb = `PENTEST{web_cred_${hexWeb}}`;
  const flagCredReuse = `PENTEST{cred_reuse_${hexCred}}`;
  const dbPassword = `ApexSecOps${hexPass}!`;

  const scenario: NetRangeScenario = {
    id: "netrange-web-cred-reuse",
    title: "Web Reconnaissance & Multi-Host Credential Reuse",
    description: "Discover sensitive backup files on a public web server, extract internal deployment credentials, and move laterally to access the internal database host.",
    author: "CyberBLADE PenTest Range",
    subnets: [
      {
        cidr: "192.0.2.0/24",
        name: "Corporate DMZ",
        accessibleFromStart: true,
      },
    ],
    hosts: [
      {
        id: "apex-web01",
        hostname: "apex-web01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.80",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:b2:c3:d4",
          },
        ],
        services: [
          {
            port: 80,
            protocol: "tcp",
            name: "http",
            version: "nginx 1.18.0",
            banner: "Server: nginx/1.18.0",
            state: "open",
            httpData: {
              "/": {
                status: 200,
                body: `<!DOCTYPE html>
<html>
<head><title>Apex Logistics Portal</title></head>
<body>
  <h1>Apex Corporate Logistics</h1>
  <p>System status: Operational. Build 2026.04.12.</p>
  <!-- TODO: remove automated db backup before public launch: /backup/db_backup.sql -->
</body>
</html>`,
              },
              "/backup/db_backup.sql": {
                status: 200,
                body: `-- PostgreSQL database dump
-- Host: apex-db01 (192.0.2.90)  Database: logistics_db
-- Dumped by pg_dump version 13.5

CREATE TABLE app_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL
);

-- Production deploy account for database sync
-- User: svc_deploy
-- Password: ${dbPassword}
-- Flag 1: ${flagWeb}
INSERT INTO app_users (username, password_hash, role) VALUES ('svc_deploy', 'plaintext:${dbPassword}', 'admin');
`,
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
      },
      {
        id: "apex-db01",
        hostname: "apex-db01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.90",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:c3:d4:e5",
          },
        ],
        services: [
          {
            port: 22,
            protocol: "tcp",
            name: "ssh",
            version: "OpenSSH 8.4p1 Debian 5",
            banner: "SSH-2.0-OpenSSH_8.4p1 Debian-5",
            state: "open",
          },
          {
            port: 5432,
            protocol: "tcp",
            name: "postgresql",
            version: "PostgreSQL 13.5",
            state: "open",
          },
        ],
        users: [
          {
            username: "svc_deploy",
            password: dbPassword,
            role: "user",
          },
          {
            username: "root",
            role: "root",
          },
        ],
        filesystem: {
          "/home/svc_deploy/flag.txt": {
            content: `${flagCredReuse}\n`,
            owner: "svc_deploy",
            permissions: "640",
          },
          "/home/svc_deploy/.bash_history": {
            content: "psql -U svc_deploy -d logistics_db\nexit\n",
            owner: "svc_deploy",
            permissions: "600",
          },
        },
      },
    ],
    flags: [
      {
        id: "flag_web",
        flag: flagWeb,
        hostId: "apex-web01",
        path: "/backup/db_backup.sql",
        objectiveId: "obj_web",
      },
      {
        id: "flag_cred_reuse",
        flag: flagCredReuse,
        hostId: "apex-db01",
        path: "/home/svc_deploy/flag.txt",
        objectiveId: "obj_cred_reuse",
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
      flag_web: flagWeb,
      flag_cred_reuse: flagCredReuse,
    },
  };
}

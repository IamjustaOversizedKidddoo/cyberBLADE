import type { GeneratorOutput } from "../index";
import type { Rng } from "../rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

/**
 * Scenario (a): Single host foothold -> privesc
 * - Target: 192.0.2.50 (apex-srv01)
 * - Attack Path:
 *   1. Nmap scan reveals vsftpd 2.3.4 on port 21
 *   2. Searchsploit finds vsftpd 2.3.4 backdoor exploit
 *   3. Metasploit exploit/unix/ftp/vsftpd_234_backdoor obtains foothold as operator
 *   4. Cat /home/operator/flag.txt yields foothold flag
 *   5. sudo -l reveals NOPASSWD: /usr/bin/find
 *   6. sudo find . -exec /bin/sh \; breaks out into root shell
 *   7. Cat /root/flag.txt yields root privesc flag
 */
export function netrangeFootholdPrivesc(
  rng: Rng,
  _params: Record<string, unknown>,
): GeneratorOutput {
  const hexFoothold = rng.hex(8);
  const hexRoot = rng.hex(8);

  const flagFoothold = `PENTEST{foothold_${hexFoothold}}`;
  const flagRoot = `PENTEST{root_privesc_${hexRoot}}`;

  const scenario: NetRangeScenario = {
    id: "netrange-foothold-privesc",
    title: "Host Exploitation & Linux Privilege Escalation",
    description: "Enumerate an exposed service, trigger a backdoor exploit to gain a user shell, and exploit sudo permissions to escalate to root.",
    author: "CyberBLADE PenTest Range",
    subnets: [
      {
        cidr: "192.0.2.0/24",
        name: "External DMZ",
        accessibleFromStart: true,
      },
    ],
    hosts: [
      {
        id: "apex-srv01",
        hostname: "apex-srv01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.50",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:a1:b2:c3",
          },
        ],
        services: [
          {
            port: 21,
            protocol: "tcp",
            name: "ftp",
            version: "vsftpd 2.3.4",
            banner: "220 (vsftpd 2.3.4)",
            state: "open",
          },
          {
            port: 22,
            protocol: "tcp",
            name: "ssh",
            version: "OpenSSH 8.2p1 Ubuntu 4ubuntu0.5",
            state: "open",
          },
          {
            port: 80,
            protocol: "tcp",
            name: "http",
            version: "Apache httpd 2.4.41 ((Ubuntu))",
            state: "open",
            httpData: {
              "/": {
                status: 200,
                body: "<!DOCTYPE html><html><head><title>Apex Systems Maintenance</title></head><body><h1>Apex Systems Portal</h1><p>Scheduled maintenance in progress. All SSH logins are audited.</p></body></html>",
              },
            },
          },
        ],
        users: [
          {
            username: "operator",
            password: "operatorPassword123!",
            role: "user",
          },
          {
            username: "root",
            role: "root",
          },
        ],
        filesystem: {
          "/home/operator/flag.txt": {
            content: `${flagFoothold}\n`,
            owner: "operator",
            permissions: "644",
          },
          "/root/flag.txt": {
            content: `${flagRoot}\n`,
            owner: "root",
            permissions: "600",
          },
          "/etc/passwd": {
            content: "root:x:0:0:root:/root:/bin/bash\noperator:x:1000:1000:Operator,,,:/home/operator:/bin/bash\n",
            owner: "root",
            permissions: "644",
          },
        },
        sudoRules: [
          {
            user: "operator",
            runAs: "root",
            command: "/usr/bin/find",
            nopasswd: true,
          },
        ],
        vulnerabilities: [
          {
            id: "vsftpd_234_backdoor",
            name: "vsftpd 2.3.4 Backdoor Execution",
            cve: "CVE-2011-2523",
            port: 21,
            service: "ftp",
            exploitPayload: "unix/ftp/vsftpd_234_backdoor",
            searchsploitTitle: "vsftpd 2.3.4 - Backdoor Command Execution",
            searchsploitPath: "unix/remote/17491.rb",
            effect: {
              type: "shell",
              targetUser: "operator",
            },
          },
        ],
      },
    ],
    flags: [
      {
        id: "flag_foothold",
        flag: flagFoothold,
        hostId: "apex-srv01",
        path: "/home/operator/flag.txt",
        objectiveId: "obj_foothold",
      },
      {
        id: "flag_root",
        flag: flagRoot,
        hostId: "apex-srv01",
        path: "/root/flag.txt",
        objectiveId: "obj_root",
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
      flag_foothold: flagFoothold,
      flag_root: flagRoot,
    },
  };
}

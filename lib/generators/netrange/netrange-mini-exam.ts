import type { GeneratorOutput } from "../index";
import type { Rng } from "../rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

/**
 * Scenario (e): "Mini Exam" Capstone Rehearsal - 4 Hosts Across 2 Subnets
 * Combining:
 *   - Reconnaissance (Nmap port & version scan)
 *   - Web Exploitation (SQL Injection data extraction)
 *   - Password Cracking (John/Hashcat MD5 dictionary attack)
 *   - Linux Privilege Escalation (Sudo GTFOBins breakout)
 *   - Network Pivoting (Route table discovery & subnet routing)
 *   - Metasploit Exploitation (vsftpd backdoor execution)
 *   - Windows Remote Access & Service Misconfig PrivEsc (Unquoted service path -> SYSTEM)
 *
 * Topology:
 *   Subnet 1: 192.0.2.0/24 (Perimeter DMZ)
 *     - Host 1: 192.0.2.10 (exam-web01)
 *     - Host 2: 192.0.2.20 / 172.16.20.1 (exam-gw01)
 *   Subnet 2: 172.16.20.0/24 (Internal Network - blocked until routed via exam-gw01)
 *     - Host 3: 172.16.20.30 (exam-internal01)
 *     - Host 4: 172.16.20.40 (exam-win01)
 */
export function netrangeMiniExam(
  rng: Rng,
  _params: Record<string, unknown>,
): GeneratorOutput {
  const hexWeb = rng.hex(8);
  const hexGw = rng.hex(8);
  const hexInternal = rng.hex(8);
  const hexCrown = rng.hex(8);

  const flagWeb = `PENTEST{exam_web_${hexWeb}}`;
  const flagGw = `PENTEST{exam_gw_${hexGw}}`;
  const flagInternal = `PENTEST{exam_internal_${hexInternal}}`;
  const flagCrown = `PENTEST{exam_win_crown_${hexCrown}}`;

  // Standard dictionary candidate word from rockyou: "password", "admin123", or "summer2024"
  const wordChoices = [
    { pass: "password", hash: "5f4dcc3b5aa765d61d8327deb882cf99" },
    { pass: "admin123", hash: "0192023a7bbd73250516f069df18b500" },
    { pass: "hunter2", hash: "2ab96390c7dbe3439de74d0c9b0b1767" },
  ];
  const selectedWord = rng.pick(wordChoices);
  const gwPassword = selectedWord.pass;
  const gwHash = selectedWord.hash;

  const winPassword = `WinAnalyst${rng.hex(4)}!`;

  const scenario: NetRangeScenario = {
    id: "netrange-mini-exam",
    title: "eJPT Comprehensive Mini-Exam: 4 Hosts, Dual-Subnet Engagement",
    description: "Rehearsal multi-host practical exam combining perimeter web exploitation, hash cracking, Linux sudo privesc, internal subnet pivoting, Metasploit execution, and Windows service privilege escalation.",
    author: "CyberBLADE PenTest Range",
    subnets: [
      {
        cidr: "192.0.2.0/24",
        name: "Perimeter DMZ Subnet",
        accessibleFromStart: true,
      },
      {
        cidr: "172.16.20.0/24",
        name: "Internal Operations Subnet",
        accessibleFromStart: false,
      },
    ],
    pivotRules: [
      {
        targetSubnet: "172.16.20.0/24",
        viaHost: "exam-gw01",
        requiresCompromise: true,
      },
    ],
    hosts: [
      {
        id: "exam-web01",
        hostname: "exam-web01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.10",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:01:aa:10",
          },
        ],
        services: [
          {
            port: 80,
            protocol: "tcp",
            name: "http",
            version: "Apache/2.4.41 (Ubuntu)",
            banner: "Apache/2.4.41",
            state: "open",
            httpData: {
              "/": {
                status: 200,
                body: "<!DOCTYPE html><html><head><title>Apex Enterprise Web</title></head><body><h1>Apex Operations Portal</h1><p>Internal employee database accessible at /portal/users.php?id=1</p></body></html>\n",
              },
              "/portal/users.php": {
                status: 200,
                body: JSON.stringify(
                  {
                    status: "SUCCESS",
                    query: "SELECT id, username, email FROM users WHERE id=1",
                    result: { id: 1, username: "sysadmin", email: "admin@apex.corp" },
                    notes: "Use standard SQL queries. Sensitive hashes restricted to admin table.",
                  },
                  null,
                  2,
                ) + "\n",
              },
              "/portal/users.php?id=1": {
                status: 200,
                body: JSON.stringify(
                  {
                    status: "SUCCESS",
                    result: { id: 1, username: "sysadmin", email: "admin@apex.corp" },
                  },
                  null,
                  2,
                ) + "\n",
              },
              "/portal/users.php?id=1+UNION+SELECT+1,username,password_hash+FROM+users": {
                status: 200,
                body: JSON.stringify(
                  {
                    status: "INJECTION_SUCCESS",
                    flag: flagWeb,
                    extracted_credentials: [
                      { username: "gw_operator", hash_type: "MD5", hash: gwHash },
                      { username: "webadmin", hash_type: "MD5", hash: "21232f297a57a5a743894a0e4a801fc3" },
                    ],
                    target_note: "gw_operator credentials authenticate to perimeter router 192.0.2.20.",
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
      },
      {
        id: "exam-gw01",
        hostname: "exam-gw01",
        os: "linux",
        interfaces: [
          {
            ip: "192.0.2.20",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:01:aa:20",
          },
          {
            ip: "172.16.20.1",
            subnet: "172.16.20.0/24",
            mac: "00:50:56:02:bb:01",
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
        ],
        users: [
          {
            username: "gw_operator",
            password: gwPassword,
            hash: gwHash,
            role: "user",
          },
          {
            username: "root",
            role: "root",
          },
        ],
        sudoRules: [
          {
            user: "gw_operator",
            runAs: "root",
            command: "/usr/bin/find",
            nopasswd: true,
          },
        ],
        filesystem: {
          "/home/gw_operator/notes.txt": {
            content: "Check eth1 routing into 172.16.20.0/24.\nInternal application server at 172.16.20.30.\nWindows domain controller at 172.16.20.40.\n",
            owner: "gw_operator",
          },
          "/root/flag.txt": {
            content: `${flagGw}\n`,
            owner: "root",
            permissions: "-rw-------",
          },
        },
      },
      {
        id: "exam-internal01",
        hostname: "exam-internal01",
        os: "linux",
        interfaces: [
          {
            ip: "172.16.20.30",
            subnet: "172.16.20.0/24",
            mac: "00:50:56:02:bb:30",
          },
        ],
        services: [
          {
            port: 21,
            protocol: "tcp",
            name: "ftp",
            version: "vsftpd 2.3.4",
            banner: "220 (vsFTPd 2.3.4)",
            state: "open",
          },
        ],
        vulnerabilities: [
          {
            id: "vsftpd-backdoor-exam",
            name: "vsftpd 2.3.4 Backdoor Command Execution",
            cve: "CVE-2011-2523",
            port: 21,
            service: "ftp",
            searchsploitTitle: "vsftpd 2.3.4 - Backdoor Command Execution",
            searchsploitPath: "unix/remote/17491.rb",
            effect: {
              type: "shell",
              targetUser: "appuser",
            },
          },
        ],
        users: [
          {
            username: "appuser",
            role: "user",
          },
        ],
        filesystem: {
          "/home/appuser/flag.txt": {
            content: `${flagInternal}\n`,
            owner: "appuser",
          },
          "/home/appuser/ad_credentials.txt": {
            content: `[INTERNAL DOMAIN ACCESS]\nWindows Server: 172.16.20.40 (exam-win01)\nSMB Share: //172.16.20.40/finance\nContractor Login: win_analyst\nPassword: ${winPassword}\n`,
            owner: "appuser",
          },
        },
      },
      {
        id: "exam-win01",
        hostname: "exam-win01",
        os: "windows",
        interfaces: [
          {
            ip: "172.16.20.40",
            subnet: "172.16.20.0/24",
            mac: "00:50:56:02:bb:40",
          },
        ],
        services: [
          {
            port: 445,
            protocol: "tcp",
            name: "microsoft-ds",
            version: "Windows Server 2019 Standard 17763",
            state: "open",
            smbData: [
              {
                name: "finance",
                comment: "Corporate Accounting & Payroll Share",
                readOnly: true,
                files: {
                  "payroll_notes.txt": `User: win_analyst\nPass: ${winPassword}\nService 'ApexMaintenanceSvc' unquoted path verification pending.\n`,
                },
              },
            ],
          },
          {
            port: 5985,
            protocol: "tcp",
            name: "wsman",
            version: "Microsoft HTTPAPI httpd 2.0",
            state: "open",
          },
          {
            port: 22,
            protocol: "tcp",
            name: "ssh",
            version: "OpenSSH_for_Windows_8.1",
            state: "open",
          },
        ],
        users: [
          {
            username: "win_analyst",
            password: winPassword,
            role: "user",
          },
          {
            username: "Administrator",
            role: "administrator",
          },
        ],
        windowsServices: [
          {
            name: "ApexMaintenanceSvc",
            displayName: "Apex System Maintenance Service",
            binPath: "C:\\Program Files\\Apex Maintenance Suite\\maint_agent.exe",
            startType: "demand",
            runAs: "LocalSystem",
            state: "STOPPED",
            unquotedPath: true,
          },
        ],
        filesystem: {
          "C:\\Users\\win_analyst\\flag.txt": {
            content: "Foothold verified. Escalate to Administrator for the crown jewel flag.\n",
            owner: "win_analyst",
          },
          "C:\\Users\\Administrator\\flag.txt": {
            content: `${flagCrown}\n`,
            owner: "Administrator",
          },
        },
      },
    ],
    flags: [
      {
        id: "flag_web",
        flag: flagWeb,
        hostId: "exam-web01",
        path: "/portal/users.php",
        objectiveId: "obj_web",
      },
      {
        id: "flag_gw",
        flag: flagGw,
        hostId: "exam-gw01",
        path: "/root/flag.txt",
        objectiveId: "obj_gateway",
      },
      {
        id: "flag_internal",
        flag: flagInternal,
        hostId: "exam-internal01",
        path: "/home/appuser/flag.txt",
        objectiveId: "obj_internal",
      },
      {
        id: "flag_crown",
        flag: flagCrown,
        hostId: "exam-win01",
        path: "C:\\Users\\Administrator\\flag.txt",
        objectiveId: "obj_crown",
      },
    ],
    wordlists: {
      hashes: [gwHash],
      rockyou: ["admin", "password", "123456", "admin123", "hunter2", "welcome", "summer2024"],
    },
    randomizationPoints: {
      gwPassword,
      gwHash,
      winPassword,
      hexWeb,
      hexGw,
      hexInternal,
      hexCrown,
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
      flag_web: flagWeb,
      flag_gateway: flagGw,
      flag_internal: flagInternal,
      flag_crown: flagCrown,
    },
  };
}

import type { GeneratorOutput } from "../index";
import type { Rng } from "../rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

/**
 * Scenario (c): Windows Host - SMB Enumeration -> Weak Credentials -> Service Misconfiguration Privilege Escalation
 * - Target: 192.0.2.120 (WIN-SRV01)
 * - Attack Path:
 *   1. Attacker discovers Windows host WIN-SRV01 on 192.0.2.120.
 *   2. SMB enumeration (smbclient or enum4linux-ng) reveals readable share '//192.0.2.120/engineering'.
 *   3. Extracting 'contractor_notes.txt' recovers credentials for contractor account and Flag 1 (smb_win).
 *   4. Attacker connects via evil-winrm or ssh as contractor:ContractorPass<seed>!
 *   5. Host reconnaissance with 'sc qc ApexBackupSvc' or 'wmic service' reveals an unquoted service path running as LocalSystem.
 *   6. Starting the service ('sc start ApexBackupSvc' or 'net start ApexBackupSvc') spawns an elevated NT AUTHORITY\SYSTEM session.
 *   7. Operator reads 'C:\Users\Administrator\flag.txt' to retrieve Flag 2 (win_privesc).
 */
export function netrangeWindowsSmbPrivesc(
  rng: Rng,
  _params: Record<string, unknown>,
): GeneratorOutput {
  const hexSmb = rng.hex(8);
  const hexPriv = rng.hex(8);
  const hexPass = rng.hex(4);

  const flagSmb = `PENTEST{smb_win_${hexSmb}}`;
  const flagPrivesc = `PENTEST{win_privesc_${hexPriv}}`;
  const contractorPass = `ContractorPass${hexPass}!`;

  const scenario: NetRangeScenario = {
    id: "netrange-windows-smb-privesc",
    title: "Windows SMB Reconnaissance & Service Misconfiguration PrivEsc",
    description: "Enumerate an exposed Windows SMB share to extract contractor credentials, establish remote access, and exploit an unquoted service path running as LocalSystem to elevate privileges to Administrator.",
    author: "CyberBLADE PenTest Range",
    subnets: [
      {
        cidr: "192.0.2.0/24",
        name: "Corporate Windows Subnet",
        accessibleFromStart: true,
      },
    ],
    hosts: [
      {
        id: "win-srv01",
        hostname: "WIN-SRV01",
        os: "windows",
        interfaces: [
          {
            ip: "192.0.2.120",
            subnet: "192.0.2.0/24",
            mac: "00:50:56:a1:b2:c3",
          },
        ],
        services: [
          {
            port: 445,
            protocol: "tcp",
            name: "microsoft-ds",
            version: "Windows Server 2019 Standard 17763 microsoft-ds",
            banner: "Microsoft Windows Server 2019 Standard (SMB2/SMB3)",
            state: "open",
            smbData: [
              {
                name: "engineering",
                comment: "Internal Engineering Onboarding Share",
                readOnly: true,
                files: {
                  "contractor_notes.txt": `[APEX CORP IT ONBOARDING]
Assigned User: contractor
Temporary Pass: ${contractorPass}
Authorized Remote: WinRM (Port 5985) or SSH (Port 22)
Flag 1: ${flagSmb}

Reminder: Maintenance service 'ApexBackupSvc' requires manual trigger after data migrations.
`,
                  "readme.txt": "Apex Engineering share for vendor onboarding.\nDo not store production keys here.\n",
                },
              },
            ],
          },
          {
            port: 5985,
            protocol: "tcp",
            name: "wsman",
            version: "Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)",
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
            username: "contractor",
            password: contractorPass,
            role: "user",
          },
          {
            username: "Administrator",
            role: "administrator",
          },
        ],
        windowsServices: [
          {
            name: "ApexBackupSvc",
            displayName: "Apex Corporate Backup Service",
            binPath: "C:\\Program Files\\Apex Backup Solutions\\backup_agent.exe",
            startType: "demand",
            runAs: "LocalSystem",
            state: "STOPPED",
            unquotedPath: true,
          },
          {
            name: "Spooler",
            displayName: "Print Spooler",
            binPath: "C:\\Windows\\System32\\spoolsv.exe",
            startType: "auto",
            runAs: "LocalSystem",
            state: "RUNNING",
          },
        ],
        filesystem: {
          "C:\\Users\\contractor\\flag.txt": {
            content: `${flagSmb}\n`,
            owner: "contractor",
          },
          "C:\\Users\\contractor\\Desktop\\notes.txt": {
            content: "Check ApexBackupSvc configuration before maintenance window.\n",
            owner: "contractor",
          },
          "C:\\Users\\Administrator\\flag.txt": {
            content: `${flagPrivesc}\n`,
            owner: "Administrator",
          },
          "C:\\Program Files\\Apex Backup Solutions\\readme.txt": {
            content: "Apex Enterprise Backup Utility v4.1\nRunning under LocalSystem\n",
            owner: "Administrator",
          },
        },
      },
    ],
    flags: [
      {
        id: "flag_smb",
        flag: flagSmb,
        hostId: "win-srv01",
        path: "C:\\Users\\contractor\\flag.txt",
        objectiveId: "obj_smb",
      },
      {
        id: "flag_privesc",
        flag: flagPrivesc,
        hostId: "win-srv01",
        path: "C:\\Users\\Administrator\\flag.txt",
        objectiveId: "obj_privesc",
      },
    ],
    randomizationPoints: {
      contractorPass,
      hexSmb,
      hexPriv,
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
      flag_smb: flagSmb,
      flag_privesc: flagPrivesc,
    },
  };
}

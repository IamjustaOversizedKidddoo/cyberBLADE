import type { NetRangeScenario, NetRangeState } from "../types";
import { findHostByIpOrName, isTargetRoutable } from "./util";

export function execSmbclient(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState } {
  let targetSpec = "";
  let listMode = false;
  let commandStr = "";

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-L" && i + 1 < argv.length) {
      listMode = true;
      targetSpec = argv[++i];
    } else if (a === "-c" && i + 1 < argv.length) {
      commandStr = argv[++i];
    } else if (a.startsWith("//") || a.startsWith("\\\\")) {
      targetSpec = a;
    }
  }

  if (!targetSpec) {
    return {
      stdout: "",
      stderr: "Usage: smbclient [-L <host>] [-c <command>] [//host/share]\n",
      code: 1,
    };
  }

  const cleanTarget = targetSpec.replace(/^[\\/]+/, "");
  const [hostPart, ...shareParts] = cleanTarget.split(/[\\/]/);
  const shareName = shareParts.join("/");

  const host = findHostByIpOrName(scenario, hostPart);
  if (!host) {
    return { stdout: "", stderr: `Connection to ${hostPart} failed (Error NT_STATUS_BAD_NETWORK_NAME)\n`, code: 1 };
  }

  const iface = host.interfaces.find((i) => i.ip === hostPart) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return { stdout: "", stderr: `Connection to ${hostPart} failed (Error NT_STATUS_HOST_UNREACHABLE)\n`, code: 1 };
  }

  const smbSvc = host.services.find((s) => s.port === 445 || s.name === "smb" || s.name === "microsoft-ds");
  if (!smbSvc) {
    return { stdout: "", stderr: `Connection to ${hostPart} failed (Error NT_STATUS_CONNECTION_REFUSED)\n`, code: 1 };
  }

  const shares = smbSvc.smbData ?? [
    { name: "ADMIN$", comment: "Remote Admin", readOnly: true },
    { name: "C$", comment: "Default share", readOnly: true },
    { name: "IPC$", comment: "Remote IPC", readOnly: true },
    { name: "public", comment: "Public Documents", readOnly: false },
  ];

  if (listMode) {
    const out: string[] = [
      `\n\tSharename       Type      Comment`,
      `\t---------       ----      -------`,
    ];
    for (const sh of shares) {
      out.push(`\t${sh.name.padEnd(16)}Disk      ${sh.comment ?? ""}`);
    }
    out.push(`\nReconnecting with SMB1 for workgroup listing.\n\tServer               Comment\n\t---------            -------`);
    out.push(`\t${host.hostname.toUpperCase().padEnd(21)}${host.os === "windows" ? "Windows Server" : "Samba Server"}\n`);
    return { stdout: out.join("\n"), stderr: "", code: 0 };
  }

  // Connecting to a specific share
  const targetShare = shares.find((s) => s.name.toLowerCase() === shareName.toLowerCase());
  if (!targetShare) {
    return { stdout: "", stderr: `tree connect failed: NT_STATUS_BAD_NETWORK_NAME\n`, code: 1 };
  }

  const nextState = { ...state };
  const shareFiles = targetShare.files ?? {
    "welcome.txt": "Welcome to Apex Corp shared repository.\n",
    "notes.txt": "Backup service account configured: svc_backup / P@ssw0rd2026!\n",
  };

  if (commandStr) {
    const out: string[] = [];
    const cmds = commandStr.split(";").map((c) => c.trim());
    for (const c of cmds) {
      const [cmd, ...cargs] = c.split(/\s+/);
      if (cmd === "ls" || cmd === "dir") {
        out.push(`  .                                   D        0  Thu Oct 17 11:52:00 2026`);
        out.push(`  ..                                  D        0  Thu Oct 17 11:50:00 2026`);
        for (const [fname, fcontent] of Object.entries(shareFiles)) {
          out.push(`  ${fname.padEnd(35)} N     ${fcontent.length}  Thu Oct 17 11:51:00 2026`);
        }
      } else if (cmd === "get" && cargs[0]) {
        const fileTarget = cargs[0];
        if (shareFiles[fileTarget]) {
          nextState.downloadedFiles = {
            ...nextState.downloadedFiles,
            [fileTarget]: shareFiles[fileTarget],
          };
          out.push(`getting file \\${fileTarget} of size ${shareFiles[fileTarget].length} as ${fileTarget} (104.2 KBytes/sec)`);
        } else {
          out.push(`NT_STATUS_NO_SUCH_FILE opening remote file \\${fileTarget}`);
        }
      } else if (cmd === "cat" && cargs[0]) {
        const fileTarget = cargs[0];
        if (shareFiles[fileTarget]) {
          out.push(shareFiles[fileTarget]);
        } else {
          out.push(`NT_STATUS_NO_SUCH_FILE opening remote file \\${fileTarget}`);
        }
      }
    }
    return { stdout: out.join("\n") + "\n", stderr: "", code: 0, nextState };
  }

  return {
    stdout: `Connected to //${host.hostname}/${targetShare.name}. Type "help" or run with -c "<commands>".\n`,
    stderr: "",
    code: 0,
  };
}

export function execEnum4linux(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number } {
  const target = argv[1];
  if (!target) {
    return { stdout: "", stderr: "Usage: enum4linux <target-ip>\n", code: 1 };
  }

  const host = findHostByIpOrName(scenario, target);
  if (!host) {
    return { stdout: "", stderr: `[E] Can't find host ${target}\n`, code: 1 };
  }

  const iface = host.interfaces.find((i) => i.ip === target) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return { stdout: "", stderr: `[E] Host ${target} unreachable\n`, code: 1 };
  }

  const usersList = host.users.map((u) => u.username).join(", ");
  const out = `
Starting enum4linux v0.9.1 ( http://labs.portcullis.co.uk/application/enum4linux/ )
 =========================================( Target Information )=========================================
Target ........... ${iface.ip}
RID Range ........ 500-550,1000-1050
Username ......... ''
Password ......... ''

 =========================================( Enumerating Workgroup/Domain )=========================================
[+] Got domain/workgroup name: APEXCORP

 =========================================( Session Check on ${iface.ip} )=========================================
[+] Server ${iface.ip} allows sessions using username '', password ''

 =========================================( Getting OS information )=========================================
[+] Got OS info for ${iface.ip} from srvsvc:
${host.os === "windows" ? "Windows Server 2019 Standard 17763" : "Linux (Samba 4.9.5-Debian)"}

 =========================================( Users on ${iface.ip} )=========================================
[+] Enumerated local users: ${usersList}

 =========================================( Share Enumeration on ${iface.ip} )=========================================
[+] Disk share found: public (Anonymous read allowed)
[+] IPC share found: IPC$

enum4linux complete.
`;
  return { stdout: out.trim() + "\n", stderr: "", code: 0 };
}

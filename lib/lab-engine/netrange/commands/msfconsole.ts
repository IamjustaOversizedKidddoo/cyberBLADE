import type { NetRangeScenario, NetRangeSession, NetRangeState } from "../types";
import { findHostByIpOrName, formatPrompt, isTargetRoutable } from "./util";

export function execMsfconsole(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState; prompt?: string } {
  // If user just typed "msfconsole" from bash
  if (argv[0] === "msfconsole" && !state.msfContext) {
    const nextState: NetRangeState = {
      ...state,
      msfContext: {
        options: {},
      },
    };
    const banner = `
       =[ metasploit v6.3.4-dev                          ]
+ -- --=[ 2300 exploits - 1204 auxiliary - 412 post       ]
+ -- --=[ 1385 payloads - 46 encoders - 11 nops           ]
+ -- --=[ Free Software Foundation (GPLv2)                ]

Metasploit tip: Use the 'search' command to find modules by keyword.
`;
    return {
      stdout: banner.trim() + "\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  // Inside MSF console or running msf commands
  const cmd = argv[0].toLowerCase();
  const nextState: NetRangeState = {
    ...state,
    msfContext: state.msfContext
      ? {
          selectedModule: state.msfContext.selectedModule,
          options: { ...state.msfContext.options },
        }
      : { options: {} },
  };
  const ctx = nextState.msfContext!;

  if (cmd === "exit" || cmd === "quit") {
    nextState.msfContext = undefined;
    return {
      stdout: "[*] Exiting Metasploit console.\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "back") {
    ctx.selectedModule = undefined;
    return {
      stdout: "",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "help" || cmd === "?") {
    const help = `
Core Commands
=============

    Command       Description
    -------       -----------
    search <term> Search module names and descriptions
    use <name>    Interact with a module by name or index
    set <opt> <v> Set a context-specific variable to a value
    show options  Displays options for the current module
    exploit / run Launch an exploit or run an auxiliary/post module
    sessions      Dump session listings and display information about sessions
    route         Route traffic through an active session
    back          Move back from the current context
    exit / quit   Exit the console
`;
    return { stdout: help.trim() + "\n", stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "search") {
    const term = argv.slice(1).join(" ").toLowerCase();
    if (!term) {
      return { stdout: "", stderr: "[-] Usage: search <term>\nExample: search vsftpd\n", code: 1, nextState, prompt: formatPrompt(nextState, scenario) };
    }

    const availableModules = [
      {
        name: "exploit/unix/ftp/vsftpd_234_backdoor",
        date: "2011-07-03",
        rank: "excellent",
        check: "No",
        desc: "VSFTPD v2.3.4 Backdoor Execution",
      },
      {
        name: "exploit/multi/samba/usermap_script",
        date: "2007-05-14",
        rank: "excellent",
        check: "No",
        desc: "Samba \"username map script\" Command Execution",
      },
      {
        name: "exploit/multi/http/apache_normalize_path_rce",
        date: "2021-10-05",
        rank: "excellent",
        check: "Yes",
        desc: "Apache 2.4.49/2.4.50 Path Traversal & RCE",
      },
    ];

    for (const host of scenario.hosts) {
      for (const vuln of host.vulnerabilities ?? []) {
        if (vuln.exploitPayload && !availableModules.some((m) => m.name === vuln.exploitPayload)) {
          availableModules.push({
            name: vuln.exploitPayload,
            date: "2024-01-01",
            rank: "excellent",
            check: "Yes",
            desc: vuln.name,
          });
        }
      }
    }

    const matches = availableModules.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.desc.toLowerCase().includes(term),
    );

    const out: string[] = [
      "Matching Modules",
      "================",
      "",
      "   #  Name                                          Disclosure Date  Rank       Check  Description",
      "   -  ----                                          ---------------  ----       -----  -----------",
    ];

    matches.forEach((m, idx) => {
      out.push(
        `   ${idx}  ${m.name.padEnd(46)}  ${m.date}       ${m.rank.padEnd(11)}${m.check.padEnd(7)}${m.desc}`,
      );
    });

    if (matches.length === 0) {
      out.push("   No matching modules found.");
    }

    return {
      stdout: out.join("\n") + "\n\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "use") {
    const mod = argv[1];
    if (!mod) {
      return { stdout: "", stderr: "[-] Usage: use <module_name>\n", code: 1 };
    }
    const cleanMod = mod.replace(/^exploit\//, "");
    ctx.selectedModule = cleanMod;
    return {
      stdout: `[*] Using exploit/${cleanMod}\n`,
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "set") {
    const key = argv[1]?.toUpperCase();
    const val = argv[2];
    if (!key || !val) {
      return { stdout: "", stderr: "[-] Usage: set <OPTION> <VALUE>\n", code: 1 };
    }
    ctx.options[key] = val;
    return {
      stdout: `${key} => ${val}\n`,
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "show" && argv[1] === "options") {
    const rhost = ctx.options.RHOSTS || ctx.options.RHOST || "";
    const rport = ctx.options.RPORT || "21";
    const out = `
Module options (exploit/${ctx.selectedModule ?? "generic"}):

   Name    Current Setting  Required  Description
   ----    ---------------  --------  -----------
   RHOSTS  ${rhost.padEnd(17)}yes       The target host(s), range CIDR identifier
   RPORT   ${rport.padEnd(17)}yes       The target port (TCP)
`;
    return { stdout: out.trim() + "\n", stderr: "", code: 0 };
  }

  if (cmd === "sessions") {
    const sub = argv[1];
    if (sub === "-l") {
      if (state.sessions.length === 0) {
        return { stdout: "Active sessions\n===============\n\nNo active sessions.\n\n", stderr: "", code: 0 };
      }
      const out = [
        "Active sessions",
        "===============",
        "",
        "  Id  Type   Information                     Connection",
        "  --  ----   -----------                     ----------",
      ];
      for (const s of state.sessions) {
        const host = scenario.hosts.find((h) => h.id === s.hostId);
        const ip = host?.interfaces[0].ip ?? "unknown";
        out.push(`  ${s.id}   shell  ${s.user}@${host?.hostname} (${host?.os})  192.0.2.200:4444 -> ${ip}:51200`);
      }
      return { stdout: out.join("\n") + "\n\n", stderr: "", code: 0 };
    }

    if (sub === "-i" && argv[2]) {
      const targetId = Number(argv[2]);
      const session = state.sessions.find((s) => s.id === targetId);
      if (!session) {
        return { stdout: "", stderr: `[-] Invalid session identifier: ${argv[2]}\n`, code: 1 };
      }
      const host = scenario.hosts.find((h) => h.id === session.hostId);
      nextState.currentHostId = session.hostId;
      nextState.currentUser = session.user;
      nextState.currentCwd = host?.os === "windows" ? `C:\\Users\\${session.user}` : `/home/${session.user}`;
      nextState.activeSessionId = session.id;
      nextState.msfContext = undefined;
      return {
        stdout: `[*] Starting interaction with ${session.id}...\n\n`,
        stderr: "",
        code: 0,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
  }

  if (cmd === "route") {
    // e.g. route add 172.16.50.0/24 1
    if (argv[1] === "add" && argv[2]) {
      const subnet = argv[2];
      const sessId = Number(argv[3]);
      const session = state.sessions.find((s) => s.id === sessId);
      if (!session) {
        return { stdout: "", stderr: `[-] Unknown session identifier: ${argv[3]}\n`, code: 1 };
      }
      const host = scenario.hosts.find((h) => h.id === session.hostId);
      if (!host) {
        return { stdout: "", stderr: `[-] Target host not found\n`, code: 1 };
      }

      if (!nextState.routes.includes(subnet)) {
        nextState.routes.push(subnet);
      }
      return {
        stdout: `[+] Route added for ${subnet} via Session ${sessId} (${host.hostname})\n`,
        stderr: "",
        code: 0,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
  }

  if (cmd === "exploit" || cmd === "run") {
    const targetIp = ctx.options.RHOSTS || ctx.options.RHOST;
    if (!targetIp) {
      return { stdout: "", stderr: "[-] RHOSTS option must be set before launching exploit\n", code: 1 };
    }

    const host = findHostByIpOrName(scenario, targetIp);
    if (!host) {
      return { stdout: "", stderr: `[-] Exploit failed: Target ${targetIp} could not be resolved\n`, code: 1 };
    }

    const iface = host.interfaces.find((i) => i.ip === targetIp) ?? host.interfaces[0];
    if (!isTargetRoutable(iface.ip, state.routes)) {
      return { stdout: "", stderr: `[-] Exploit failed: Host ${iface.ip} is unreachable\n`, code: 1 };
    }

    const modName = ctx.selectedModule ?? "";
    const isVsftpd = modName.includes("vsftpd") || modName.includes("ftp");
    const ftpSvc = host.services.find((s) => s.port === 21 && (s.version?.includes("2.3.4") || s.name === "ftp"));

    // Check if host has an explicit matching vulnerability defined
    const matchingVuln = host.vulnerabilities?.find(
      (v) =>
        (v.exploitPayload && modName.includes(v.exploitPayload)) ||
        (v.id && modName.toLowerCase().includes(v.id.toLowerCase())),
    );

    // Check vsftpd backdoor
    if ((isVsftpd && ftpSvc) || (matchingVuln && matchingVuln.effect.type === "shell")) {
      const targetUser = matchingVuln && matchingVuln.effect.type === "shell"
        ? matchingVuln.effect.targetUser
        : "root";
      const newSessId = (state.sessions.length > 0 ? Math.max(...state.sessions.map((s) => s.id)) : 0) + 1;
      const newSession: NetRangeSession = {
        id: newSessId,
        hostId: host.id,
        user: targetUser,
        type: "shell",
        openedAt: "2026-10-17T12:06:00Z",
      };

      nextState.currentHostId = host.id;
      nextState.currentUser = targetUser;
      nextState.currentCwd = targetUser === "root" ? "/root" : host.os === "windows" ? `C:\\Users\\${targetUser}` : `/home/${targetUser}`;
      nextState.sessions.push(newSession);
      nextState.activeSessionId = newSessId;
      nextState.msfContext = undefined;

      const out = isVsftpd && ftpSvc
        ? `
[*] ${iface.ip}:21 - Banner: 220 (${ftpSvc.version ?? "vsftpd 2.3.4"})
[*] ${iface.ip}:21 - USER: 331 Please specify the password.
[+] ${iface.ip}:21 - Backdoor service spawned!
[*] Found shell.
[*] Command shell session ${newSessId} opened (192.0.2.200:4444 -> ${iface.ip}:6200) at 2026-10-17 12:06:00 UTC
`
        : `
[*] Executing exploit ${matchingVuln?.name ?? modName} against ${iface.ip}...
[+] Payload successfully triggered!
[*] Command shell session ${newSessId} opened (192.0.2.200:4444 -> ${iface.ip}:45890)
`;

      return {
        stdout: out.trim() + "\n\n",
        stderr: "",
        code: 0,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }


    return {
      stdout: `[*] Executing exploit against ${iface.ip}...\n[-] Exploit completed, but no session was created.\n`,
      stderr: "",
      code: 1,
    };
  }

  return {
    stdout: "",
    stderr: `[-] Unknown Metasploit command: ${cmd}\n`,
    code: 1,
  };
}

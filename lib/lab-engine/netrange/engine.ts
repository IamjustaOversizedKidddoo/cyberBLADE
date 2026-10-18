import type {
  NetRangeCmdResult,
  NetRangeScenario,
  NetRangeSession,
  NetRangeState,
} from "./types";
import { findHostByIpOrName, formatPrompt, parseArgv } from "./commands/util";
import { execNmap } from "./commands/nmap";
import { execCurl } from "./commands/curl";
import { execFtp } from "./commands/ftp";
import { execSsh } from "./commands/ssh";
import { execSearchsploit } from "./commands/searchsploit";
import { execSmbclient, execEnum4linux, execEnum4linuxNg } from "./commands/smbclient";
import { execMsfconsole } from "./commands/msfconsole";
import { execJohn, execHashcat } from "./commands/john";
import { execRoute } from "./commands/route";
import { execGobuster, execFfuf } from "./commands/gobuster";
import { execHostCommand } from "./commands/host-shell";
import { isTargetRoutable } from "./commands/util";

export function createInitialNetRangeState(
  scenario: NetRangeScenario,
  overrides?: Partial<NetRangeState>,
): NetRangeState {
  const defaultRoutes = scenario.subnets
    .filter((s) => s.accessibleFromStart)
    .map((s) => s.cidr);

  return {
    currentHostId: null,
    currentUser: "kali",
    currentCwd: "~",
    routes: defaultRoutes,
    sessions: [],
    activeSessionId: null,
    crackedHashes: {},
    downloadedFiles: {},
    history: [],
    msfContext: undefined,
    ...overrides,
  };
}

export function execNetRangeCommand(
  rawLine: string,
  state: NetRangeState,
  scenario: NetRangeScenario,
): NetRangeCmdResult {
  const line = rawLine.trim();

  // Empty input -> redisplay prompt
  if (line === "") {
    return {
      stdout: "",
      stderr: "",
      code: 0,
      nextState: state,
      prompt: formatPrompt(state, scenario),
    };
  }

  // Handle chained commands: && or ;
  if (line.includes(" && ") || (line.includes(";") && !state.msfContext)) {
    const isAnd = line.includes(" && ");
    const parts = isAnd ? line.split(" && ") : line.split(";");
    let currentState = { ...state };
    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    let lastCode = 0;
    let submitPayload: { objective: number; answer: string } | undefined;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const res = executeSingleCommand(trimmed, currentState, scenario);
      currentState = res.nextState;
      if (res.stdout) stdoutParts.push(res.stdout);
      if (res.stderr) stderrParts.push(res.stderr);
      lastCode = res.code;
      if (res.submit) submitPayload = res.submit;

      if (isAnd && res.code !== 0) {
        break;
      }
    }

    currentState.history = [...currentState.history, line];
    return {
      stdout: stdoutParts.join(""),
      stderr: stderrParts.join(""),
      code: lastCode,
      nextState: currentState,
      prompt: formatPrompt(currentState, scenario),
      submit: submitPayload,
    };
  }

  const result = executeSingleCommand(line, state, scenario);
  const nextState: NetRangeState = {
    ...result.nextState,
    history: [...result.nextState.history, line],
  };

  return {
    ...result,
    nextState,
    prompt: formatPrompt(nextState, scenario),
  };
}

function executeSingleCommand(
  line: string,
  state: NetRangeState,
  scenario: NetRangeScenario,
): NetRangeCmdResult {
  const argv = parseArgv(line);
  if (argv.length === 0) {
    return {
      stdout: "",
      stderr: "",
      code: 0,
      nextState: state,
      prompt: formatPrompt(state, scenario),
    };
  }

  const cmd = argv[0].toLowerCase();
  const nextState: NetRangeState = {
    ...state,
    routes: [...state.routes],
    sessions: [...state.sessions],
    crackedHashes: { ...state.crackedHashes },
    downloadedFiles: { ...state.downloadedFiles },
  };

  // Special command: submit <objective> <flag> OR submit <flag>
  if (cmd === "submit") {
    let objNum = 1;
    let flagVal = "";

    if (argv.length === 2) {
      flagVal = argv[1];
      const match = scenario.flags.find((f) => f.flag === flagVal);
      if (match) {
        objNum = Number(match.objectiveId.replace(/\D/g, "")) || 1;
      }
    } else if (argv.length >= 3) {
      objNum = Number(argv[1]) || 1;
      flagVal = argv[2];
    }

    if (!flagVal) {
      return {
        stdout: "",
        stderr: "Usage: submit <flag> OR submit <objective_number> <flag>\nExample: submit 1 <flag_token>\n",
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }

    return {
      stdout: `[*] Submitting flag for Objective ${objNum}: ${flagVal}\n[+] Flag submitted to grading engine.\n`,
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
      submit: { objective: objNum, answer: flagVal },
    };
  }

  // Clear screen
  if (cmd === "clear") {
    return {
      stdout: "\x1b[2J\x1b[3J\x1b[H",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  // History
  if (cmd === "history") {
    const lines = state.history.map((h, i) => `  ${(i + 1).toString().padStart(4)}  ${h}`);
    return {
      stdout: (lines.length > 0 ? lines.join("\n") + "\n" : ""),
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  // Context: MSF Console
  if (state.msfContext) {
    const msfRes = execMsfconsole(argv, state, scenario);
    return {
      stdout: msfRes.stdout,
      stderr: msfRes.stderr,
      code: msfRes.code,
      nextState: msfRes.nextState ?? nextState,
      prompt: msfRes.prompt ?? formatPrompt(msfRes.nextState ?? nextState, scenario),
    };
  }

  // Context: Remote Host Shell
  if (state.currentHostId !== null) {
    const hostRes = execHostCommand(argv, state, scenario);
    return {
      stdout: hostRes.stdout,
      stderr: hostRes.stderr,
      code: hostRes.code,
      nextState: hostRes.nextState ?? nextState,
      prompt: hostRes.prompt ?? formatPrompt(hostRes.nextState ?? nextState, scenario),
    };
  }

  // Context: Attacker Kali Shell
  if (cmd === "help") {
    const helpText = `
CyberBLADE NetRange - Tactical Attacker Terminal
-------------------------------------------------
Network Reconnaissance:
  nmap [flags] <target/cidr>      TCP port scanner (-sS, -sV, -sC, -A, -p, -O, -Pn, -oN)
  enum4linux <target-ip>          SMB/RPC user & share enumeration
  enum4linux-ng <target-ip>       Next-gen SMB enumeration
  curl [-i] <url>                 HTTP request utility
  gobuster dir -u <url> -w <word> Web content & directory discovery
  ffuf -u <url/FUZZ> -w <word>    Fast web fuzzer
  smbclient -L <ip> / //<ip>/sh   SMB share listing & file retrieval
  ftp <target-ip>                 FTP interactive client

Exploitation & Frameworks:
  searchsploit <keyword>          Offline Exploit-DB search utility
  msfconsole                      Interactive Metasploit Framework console (search/use/set/run)
  john [--wordlist=file] <hash>   John the Ripper hash cracking utility
  hashcat -m <mode> <file> <word> Hashcat password recovery suite

Lateral Movement & Remote Access:
  ssh [user@]<target> [-D port]   Secure Shell remote login & dynamic SOCKS proxying
  evil-winrm -i <ip> -u <u> -p <p> Windows Remote Management shell
  proxychains <command> [args...] Run tool chained through active SOCKS proxy tunnel
  route [add <net> via <gw>]      Kernel routing table / subnet pivoting
  ip route [add <net> via <gw>]   Linux iproute2 subnet management
  sessions [-l | -i <id>]         Manage active background sessions

Lab Commands:
  submit <obj#> <flag>            Submit a captured flag to the grading engine
  clear                           Clear terminal screen
  history                         Display command history
`;
    return {
      stdout: helpText.trim() + "\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  // Tool dispatch
  if (cmd === "nmap") {
    const res = execNmap(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "gobuster") {
    const res = execGobuster(argv, state, scenario);
    return { ...res, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "ffuf") {
    const res = execFfuf(argv, state, scenario);
    return { ...res, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "searchsploit") {
    const res = execSearchsploit(argv, scenario);
    return { ...res, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "msfconsole") {
    const res = execMsfconsole(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: res.prompt ?? formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "smbclient") {
    const res = execSmbclient(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "enum4linux") {
    const res = execEnum4linux(argv, state, scenario);
    return { ...res, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "enum4linux-ng" || cmd === "enum4linux_ng") {
    const res = execEnum4linuxNg(argv, state, scenario);
    return { ...res, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "curl") {
    const res = execCurl(argv, state, scenario);
    return { ...res, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "ftp") {
    const res = execFtp(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "ssh") {
    const res = execSsh(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: res.prompt ?? formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "evil-winrm" || cmd === "evil_winrm") {
    let targetIp = "";
    let user = "";
    let pass = "";
    for (let i = 1; i < argv.length; i++) {
      if ((argv[i] === "-i" || argv[i] === "--ip") && i + 1 < argv.length) targetIp = argv[++i];
      else if ((argv[i] === "-u" || argv[i] === "--user") && i + 1 < argv.length) user = argv[++i];
      else if ((argv[i] === "-p" || argv[i] === "--password") && i + 1 < argv.length) pass = argv[++i];
    }
    if (!targetIp || !user) {
      return {
        stdout: "",
        stderr: "Usage: evil-winrm -i <target-ip> -u <username> -p <password>\n",
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    const host = findHostByIpOrName(scenario, targetIp);
    if (!host) {
      return {
        stdout: "",
        stderr: `[!] Error: Could not connect to ${targetIp}: Connection refused\n`,
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    const iface = host.interfaces.find((i) => i.ip === targetIp) ?? host.interfaces[0];
    if (!isTargetRoutable(iface.ip, state.routes)) {
      return {
        stdout: "",
        stderr: `[!] Error: Destination host ${targetIp} is unreachable\n`,
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    const userAcc = host.users.find((u) => u.username.toLowerCase() === user.toLowerCase());
    if (!userAcc) {
      return {
        stdout: "",
        stderr: `[!] Error: Authentication failed for ${user}\n`,
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    if (userAcc.password && pass && userAcc.password !== pass) {
      return {
        stdout: "",
        stderr: `[!] Error: Bad credentials for ${user}\n`,
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    const newSessionId = (state.sessions.length > 0 ? Math.max(...state.sessions.map((s) => s.id)) : 0) + 1;
    const newSession: NetRangeSession = {
      id: newSessionId,
      hostId: host.id,
      user: userAcc.username,
      type: "shell",
      openedAt: "2026-10-18T10:00:00Z",
    };
    const nextStateSession: NetRangeState = {
      ...state,
      currentHostId: host.id,
      currentUser: userAcc.username,
      currentCwd: `C:\\Users\\${userAcc.username}`,
      sessions: [...state.sessions, newSession],
      activeSessionId: newSessionId,
    };
    const out = `
Evil-WinRM shell v3.5
Info: Establishing connection to remote endpoint ${iface.ip}:5985
*Evil-WinRM* PS C:\\Users\\${userAcc.username}> 
`;
    return {
      stdout: out.trim() + "\n",
      stderr: "",
      code: 0,
      nextState: nextStateSession,
      prompt: formatPrompt(nextStateSession, scenario),
    };
  }

  if (cmd === "john") {
    const res = execJohn(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "hashcat") {
    const res = execHashcat(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "proxychains" || cmd === "proxychains4") {
    if (argv.length < 2) {
      return {
        stdout: "",
        stderr: "Usage: proxychains <command> [arguments]\nExample: proxychains nmap -sT -Pn 172.16.50.25\n",
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }

    const subArgv = argv.slice(1);
    const hasActiveTunnel =
      (state.socksTunnels && state.socksTunnels.length > 0) ||
      state.sessions.length > 0;

    const proxyHeader = `[proxychains] config file found: /etc/proxychains.conf\n[proxychains] preloading /usr/lib/libproxychains4.so\n`;

    if (!hasActiveTunnel) {
      return {
        stdout: proxyHeader + `[proxychains] Dynamic chain  ...  127.0.0.1:1080  ...  timeout\n`,
        stderr: `[-] Proxychains error: Could not connect to SOCKS4/5 proxy 127.0.0.1:1080 (Connection refused)\n`,
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }

    // With active tunnel, make internal subnets reachable via tunnel
    const tunnelState: NetRangeState = {
      ...state,
      routes: [...state.routes],
    };

    for (const subnet of scenario.subnets) {
      if (!tunnelState.routes.includes(subnet.cidr)) {
        tunnelState.routes.push(subnet.cidr);
      }
    }

    const subRes = executeSingleCommand(subArgv.join(" "), tunnelState, scenario);
    const targetArg = subArgv.find((a) => !a.startsWith("-") && a.match(/^\d+\.\d+\.\d+\.\d+/));
    const targetDisplay = targetArg ? `${targetArg}:80` : "target:80";
    const chainNotice = `[proxychains] Dynamic chain  ...  127.0.0.1:1080  ...  ${targetDisplay}  ...  OK\n`;

    return {
      stdout: proxyHeader + chainNotice + subRes.stdout,
      stderr: subRes.stderr,
      code: subRes.code,
      nextState: {
        ...subRes.nextState,
        routes: state.routes, // maintain base routing table
      },
      prompt: formatPrompt(subRes.nextState, scenario),
      submit: subRes.submit,
    };
  }

  if (cmd === "route") {
    const res = execRoute(argv, state, scenario);
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      nextState: res.nextState ?? nextState,
      prompt: formatPrompt(res.nextState ?? nextState, scenario),
    };
  }

  if (cmd === "ip") {
    if (argv[1] === "route" || argv[1] === "r") {
      const res = execRoute(["route", ...argv.slice(2)], state, scenario);
      return {
        stdout: res.stdout,
        stderr: res.stderr,
        code: res.code,
        nextState: res.nextState ?? nextState,
        prompt: formatPrompt(res.nextState ?? nextState, scenario),
      };
    }
    if (argv[1] === "a" || argv[1] === "addr" || argv[1] === "link") {
      const out = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    inet 192.0.2.200/24 brd 192.0.2.255 scope global eth0
`;
      return { stdout: out, stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
    }
  }

  if (cmd === "ifconfig") {
    const out = `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.0.2.200  netmask 255.255.255.0  broadcast 192.0.2.255
        ether 02:42:c0:00:02:c8  txqueuelen 1000  (Ethernet)

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        loop  txqueuelen 1000  (Local Loopback)
`;
    return { stdout: out, stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "ping") {
    const target = argv.find((a) => !a.startsWith("-") && a !== "ping");
    if (!target) {
      return { stdout: "", stderr: "ping: usage error: Destination address required\n", code: 1, nextState, prompt: formatPrompt(nextState, scenario) };
    }
    if (!isTargetRoutable(target, state.routes)) {
      return {
        stdout: `PING ${target} (${target}) 56(84) bytes of data.\nFrom 192.0.2.200 icmp_seq=1 Destination Host Unreachable\nFrom 192.0.2.200 icmp_seq=2 Destination Host Unreachable\n--- ${target} ping statistics ---\n2 packets transmitted, 0 received, +2 errors, 100% packet loss\n`,
        stderr: "",
        code: 1,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    return {
      stdout: `PING ${target} (${target}) 56(84) bytes of data.\n64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.042 ms\n64 bytes from ${target}: icmp_seq=2 ttl=64 time=0.038 ms\n--- ${target} ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss, time 1001ms\n`,
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "sessions") {
    if (argv[1] === "-l") {
      if (state.sessions.length === 0) {
        return { stdout: "Active sessions\n===============\n\nNo active sessions.\n\n", stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
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
      return { stdout: out.join("\n") + "\n\n", stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
    }
    if (argv[1] === "-i" && argv[2]) {
      const sessId = Number(argv[2]);
      const session = state.sessions.find((s) => s.id === sessId);
      if (!session) {
        return { stdout: "", stderr: `[-] Unknown session ID: ${argv[2]}\n`, code: 1, nextState, prompt: formatPrompt(nextState, scenario) };
      }
      const host = scenario.hosts.find((h) => h.id === session.hostId);
      nextState.currentHostId = session.hostId;
      nextState.currentUser = session.user;
      nextState.currentCwd = host?.os === "windows" ? `C:\\Users\\${session.user}` : `/home/${session.user}`;
      nextState.activeSessionId = session.id;
      return {
        stdout: `[*] Interacting with session ${sessId} (${host?.hostname})...\n`,
        stderr: "",
        code: 0,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
  }

  // Local attacker filesystem / shell utilities
  if (cmd === "whoami") {
    return { stdout: "kali\n", stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "id") {
    return {
      stdout: "uid=1000(kali) gid=1000(kali) groups=1000(kali),27(sudo),100(users)\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "pwd") {
    return { stdout: "/home/kali\n", stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  if (cmd === "uname") {
    return {
      stdout: "Linux kali 6.1.0-kali7-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.20-1kali1 x86_64 GNU/Linux\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "ls") {
    const files = ["rockyou.txt", ...Object.keys(state.downloadedFiles)];
    return {
      stdout: files.join("  ") + "\n",
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "cat") {
    const filename = argv[1];
    if (!filename) {
      return { stdout: "", stderr: "cat: missing file operand\n", code: 1, nextState, prompt: formatPrompt(nextState, scenario) };
    }
    if (filename === "rockyou.txt") {
      const sample = (scenario.wordlists?.["rockyou.txt"] ?? ["123456", "password", "admin", "secret", "operator123"]).slice(0, 10);
      return {
        stdout: sample.join("\n") + "\n...[truncated 14,344,380 entries]...\n",
        stderr: "",
        code: 0,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    if (state.downloadedFiles[filename]) {
      return {
        stdout: state.downloadedFiles[filename] + "\n",
        stderr: "",
        code: 0,
        nextState,
        prompt: formatPrompt(nextState, scenario),
      };
    }
    return {
      stdout: "",
      stderr: `cat: ${filename}: No such file or directory\n`,
      code: 1,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  // Realistic error for unknown commands
  return {
    stdout: "",
    stderr: `bash: ${argv[0]}: command not found\n`,
    code: 127,
    nextState,
    prompt: formatPrompt(nextState, scenario),
  };
}

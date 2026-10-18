import type { NetRangeScenario, NetRangeState } from "../types";
import { formatPrompt } from "./util";

export function execHostCommand(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState; prompt?: string } {
  const host = state.currentHostId ? scenario.hosts.find((h) => h.id === state.currentHostId) : null;
  const cmd = argv[0].toLowerCase();
  const nextState: NetRangeState = { ...state };

  if (cmd === "exit") {
    if (!state.currentHostId) {
      return { stdout: "logout\n", stderr: "", code: 0 };
    }
    // Leave host session and return to attacker
    nextState.currentHostId = null;
    nextState.currentUser = "kali";
    nextState.currentCwd = "~";
    nextState.activeSessionId = null;
    return {
      stdout: `Connection to ${host?.hostname ?? "host"} closed.\n`,
      stderr: "",
      code: 0,
      nextState,
      prompt: formatPrompt(nextState, scenario),
    };
  }

  if (cmd === "whoami") {
    return { stdout: `${state.currentUser}\n`, stderr: "", code: 0 };
  }

  if (cmd === "hostname") {
    return { stdout: `${host?.hostname ?? "localhost"}\n`, stderr: "", code: 0 };
  }

  if (cmd === "id") {
    if (state.currentUser === "root") {
      return { stdout: "uid=0(root) gid=0(root) groups=0(root)\n", stderr: "", code: 0 };
    }
    if (state.currentUser === "Administrator") {
      return { stdout: "User: Administrator (S-1-5-21-3623811015-3361044348-30300820-500) Privileges: SeDebugPrivilege\n", stderr: "", code: 0 };
    }
    return { stdout: `uid=1000(${state.currentUser}) gid=1000(${state.currentUser}) groups=1000(${state.currentUser}),4(adm),24(cdrom),27(sudo)\n`, stderr: "", code: 0 };
  }

  if (cmd === "uname") {
    if (host?.os === "windows") {
      return { stdout: "", stderr: "'uname' is not recognized as an internal or external command\n", code: 1 };
    }
    return {
      stdout: `Linux ${host?.hostname ?? "kali"} 5.4.0-107-generic #121-Ubuntu SMP Thu Mar 24 16:04:27 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux\n`,
      stderr: "",
      code: 0,
    };
  }

  if (cmd === "pwd") {
    return { stdout: `${state.currentCwd}\n`, stderr: "", code: 0 };
  }

  if (cmd === "cd") {
    const targetPath = argv[1] || (state.currentUser === "root" ? "/root" : `/home/${state.currentUser}`);
    nextState.currentCwd = targetPath;
    return { stdout: "", stderr: "", code: 0, nextState, prompt: formatPrompt(nextState, scenario) };
  }

  // Network discovery: ifconfig / ip a / ipconfig
  if (cmd === "ifconfig" || (cmd === "ip" && (argv[1] === "a" || argv[1] === "addr"))) {
    const ifaces = host ? host.interfaces : [{ ip: "192.0.2.200", subnet: "192.0.2.0/24", mac: "00:50:56:01:02:fe" }];
    const lines: string[] = [];
    ifaces.forEach((iface, idx) => {
      const dev = `eth${idx}`;
      lines.push(`${dev}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`);
      lines.push(`        inet ${iface.ip}  netmask 255.255.255.0  broadcast ${iface.ip.replace(/\.\d+$/, ".255")}`);
      lines.push(`        ether ${iface.mac ?? "52:54:00:12:34:56"}  txqueuelen 1000  (Ethernet)`);
      lines.push("");
    });
    return { stdout: lines.join("\n"), stderr: "", code: 0 };
  }

  if (cmd === "ipconfig") {
    const ifaces = host ? host.interfaces : [{ ip: "192.0.2.200", subnet: "192.0.2.0/24" }];
    const lines: string[] = ["Windows IP Configuration\n"];
    ifaces.forEach((iface, idx) => {
      lines.push(`Ethernet adapter Ethernet ${idx + 1}:`);
      lines.push(`   IPv4 Address. . . . . . . . . . . : ${iface.ip}`);
      lines.push(`   Subnet Mask . . . . . . . . . . . : 255.255.255.0`);
      lines.push("");
    });
    return { stdout: lines.join("\n"), stderr: "", code: 0 };
  }

  // File listing: ls or dir
  if (cmd === "ls" || cmd === "dir") {
    if (!host) {
      const files = Object.keys(state.downloadedFiles);
      if (files.length === 0) {
        return { stdout: "rockyou.txt\n", stderr: "", code: 0 };
      }
      return { stdout: `rockyou.txt\t${files.join("\t")}\n`, stderr: "", code: 0 };
    }

    const fs = host.filesystem ?? {};
    const visible = Object.keys(fs).filter((p) => {
      if (state.currentCwd === "/" || state.currentCwd === "~") return true;
      return p.startsWith(state.currentCwd);
    });

    if (visible.length === 0) {
      return { stdout: "", stderr: "", code: 0 };
    }
    const names = visible.map((p) => p.split("/").pop()!);
    return { stdout: names.join("  ") + "\n", stderr: "", code: 0 };
  }

  // File reading: cat or type
  if (cmd === "cat" || cmd === "type") {
    const filename = argv[1];
    if (!filename) {
      return { stdout: "", stderr: `${cmd}: missing file operand\n`, code: 1 };
    }

    if (!host) {
      if (filename === "rockyou.txt") {
        const words = scenario.wordlists?.rockyou ?? ["password", "123456", "admin123", "summer2024", "hunter2"];
        return { stdout: words.slice(0, 10).join("\n") + "\n...\n", stderr: "", code: 0 };
      }
      if (state.downloadedFiles[filename]) {
        return { stdout: state.downloadedFiles[filename] + (state.downloadedFiles[filename].endsWith("\n") ? "" : "\n"), stderr: "", code: 0 };
      }
      return { stdout: "", stderr: `cat: ${filename}: No such file or directory\n`, code: 1 };
    }

    const fs = host.filesystem ?? {};
    const matchedPath = Object.keys(fs).find(
      (p) =>
        p === filename ||
        p === `${state.currentCwd}/${filename}` ||
        p === `${state.currentCwd}\\${filename}` ||
        p.endsWith(`/${filename}`) ||
        p.endsWith(`\\${filename}`) ||
        p.toLowerCase().endsWith(`\\${filename.toLowerCase()}`) ||
        p.toLowerCase().endsWith(`/${filename.toLowerCase()}`) ||
        p === `/home/${state.currentUser}/${filename}` ||
        p === `/root/${filename}`,
    );

    if (matchedPath && fs[matchedPath]) {
      const file = fs[matchedPath];
      // Check permissions
      if (file.permissions?.startsWith("-rw-------") && file.owner === "root" && state.currentUser !== "root") {
        return { stdout: "", stderr: `cat: ${filename}: Permission denied\n`, code: 1 };
      }
      return { stdout: file.content + (file.content.endsWith("\n") ? "" : "\n"), stderr: "", code: 0 };
    }

    return { stdout: "", stderr: `cat: ${filename}: No such file or directory\n`, code: 1 };
  }

  // Echo command
  if (cmd === "echo") {
    const text = argv.slice(1).join(" ");
    return { stdout: text + "\n", stderr: "", code: 0 };
  }

  // Grep command
  if (cmd === "grep") {
    const term = argv[1];
    const filename = argv[2];
    if (!term || !filename) {
      return { stdout: "", stderr: "Usage: grep <pattern> <file>\n", code: 1 };
    }
    const fs = host?.filesystem ?? {};
    const matchedPath = Object.keys(fs).find((p) => p === filename || p.endsWith(`/${filename}`));
    if (matchedPath && fs[matchedPath]) {
      const lines = fs[matchedPath].content.split("\n").filter((l) => l.includes(term));
      return { stdout: (lines.length > 0 ? lines.join("\n") + "\n" : ""), stderr: "", code: 0 };
    }
    return { stdout: "", stderr: `grep: ${filename}: No such file or directory\n`, code: 1 };
  }

  // Process status: ps or tasklist
  if (cmd === "ps" || cmd === "tasklist") {
    if (host?.os === "windows" || cmd === "tasklist") {
      const procs = [
        "Image Name                     PID Session Name        Session#    Mem Usage",
        "========================= ======== ================ =========== ============",
        "System Idle Process              0 Services                   0          8 K",
        "System                           4 Services                   0        240 K",
        "smss.exe                       340 Services                   0      1,020 K",
        "csrss.exe                      488 Services                   0      4,320 K",
        "wininit.exe                    564 Services                   0      4,890 K",
        "services.exe                   632 Services                   0      8,450 K",
        "lsass.exe                      648 Services                   0     14,210 K",
        "svchost.exe                    780 Services                   0     21,500 K",
        "spoolsv.exe                   1240 Services                   0     11,200 K",
        "cmd.exe                       2450 Console                    1      3,120 K",
      ];
      return { stdout: procs.join("\n") + "\n", stderr: "", code: 0 };
    }

    const procs = [
      "  PID TTY          TIME CMD",
      "    1 ?        00:00:02 systemd",
      "  412 ?        00:00:00 systemd-journal",
      "  580 ?        00:00:00 cron",
      "  612 ?        00:00:01 sshd",
      "  820 ?        00:00:00 vsftpd",
      "  945 ?        00:00:00 apache2",
      " 1420 pts/0    00:00:00 bash",
      " 1580 pts/0    00:00:00 ps",
    ];
    return { stdout: procs.join("\n") + "\n", stderr: "", code: 0 };
  }

  // Netstat listening ports
  if (cmd === "netstat") {
    const lines = [
      "Active Internet connections (only servers)",
      "Proto Recv-Q Send-Q Local Address           Foreign Address         State",
    ];
    for (const svc of host?.services ?? []) {
      lines.push(`tcp        0      0 0.0.0.0:${svc.port.toString().padEnd(16)}0.0.0.0:*               LISTEN`);
    }
    return { stdout: lines.join("\n") + "\n", stderr: "", code: 0 };
  }

  // Env variables
  if (cmd === "env") {
    const envVars = [
      `USER=${state.currentUser}`,
      `HOME=${state.currentUser === "root" ? "/root" : `/home/${state.currentUser}`}`,
      "SHELL=/bin/bash",
      "TERM=xterm-256color",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      `PWD=${state.currentCwd}`,
    ];
    return { stdout: envVars.join("\n") + "\n", stderr: "", code: 0 };
  }

  // Sudo privilege escalation inspection & execution
  if (cmd === "sudo") {
    if (!host) {
      return { stdout: "", stderr: "sudo: already root on local attacker machine\n", code: 1 };
    }

    if (argv[1] === "-l") {
      const rules = host.sudoRules?.filter((r) => r.user === state.currentUser || r.user === "ALL") ?? [];
      if (rules.length === 0) {
        return {
          stdout: `User ${state.currentUser} is not allowed to run sudo on ${host.hostname}.\n`,
          stderr: "",
          code: 1,
        };
      }
      const ruleStrs = rules.map((r) => `    (${r.runAs}) ${r.nopasswd ? "NOPASSWD: " : ""}${r.command}`);
      const out = [
        `Matching Defaults entries for ${state.currentUser} on ${host.hostname}:`,
        `    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin`,
        "",
        `User ${state.currentUser} may run the following commands on ${host.hostname}:`,
        ...ruleStrs,
      ];
      return { stdout: out.join("\n") + "\n", stderr: "", code: 0 };
    }

    // Running a sudo command: e.g. `sudo find . -exec /bin/sh \;` or `sudo /usr/bin/find ...`
    const sudoTargetCmd = argv.slice(1).join(" ");
    const allowedRule = host.sudoRules?.find((r) => {
      const bin = r.command.split(/\s+/)[0];
      return sudoTargetCmd.startsWith(bin) || sudoTargetCmd.startsWith(bin.split("/").pop()!);
    });

    if (allowedRule) {
      // Check GTFOBins shell escape patterns
      const isShellEscape =
        sudoTargetCmd.includes("-exec /bin/sh") ||
        sudoTargetCmd.includes("-exec /bin/bash") ||
        sudoTargetCmd.includes("-exec sh") ||
        sudoTargetCmd.includes("-exec bash") ||
        sudoTargetCmd.includes(":!/bin/sh") ||
        sudoTargetCmd.includes(":!/bin/bash") ||
        sudoTargetCmd.includes("system(\"/bin/sh\")") ||
        sudoTargetCmd.includes("system(\"/bin/bash\")") ||
        sudoTargetCmd.includes("import os; os.system") ||
        sudoTargetCmd.includes("--checkpoint-action=exec=") ||
        sudoTargetCmd === "su" ||
        sudoTargetCmd === "/bin/sh" ||
        sudoTargetCmd === "/bin/bash" ||
        sudoTargetCmd === "sh" ||
        sudoTargetCmd === "bash";

      if (isShellEscape) {
        nextState.currentUser = "root";
        nextState.currentCwd = "/root";
        return {
          stdout: "Spawning root shell via GTFOBins execution primitive.\n",
          stderr: "",
          code: 0,
          nextState,
          prompt: formatPrompt(nextState, scenario),
        };
      }

      return {
        stdout: `Executed ${sudoTargetCmd} as root.\n`,
        stderr: "",
        code: 0,
      };
    }

    return {
      stdout: "",
      stderr: `[sudo] password for ${state.currentUser}: \nSorry, user ${state.currentUser} is not allowed to execute '${sudoTargetCmd}' as root on ${host.hostname}.\n`,
      code: 1,
    };
  }

  // Find SUID binaries: `find / -perm -4000 ...`
  if (cmd === "find") {
    const line = argv.join(" ");
    if (line.includes("-perm -4000") || line.includes("-perm -u=s") || line.includes("-perm /4000")) {
      const suids: string[] = [
        "/usr/bin/passwd",
        "/usr/bin/chfn",
        "/usr/bin/newgrp",
        "/usr/bin/sudo",
      ];
      if (host?.filesystem) {
        for (const [p, f] of Object.entries(host.filesystem)) {
          if (f.isSuid) suids.push(p);
        }
      }
      return { stdout: suids.join("\n") + "\n", stderr: "", code: 0 };
    }
    return { stdout: ".\n", stderr: "", code: 0 };
  }

  // Windows net command: net user, net start, net localgroup
  if (cmd === "net") {
    if (argv[1] === "user") {
      const names = host?.users.map((u) => u.username) ?? ["Administrator", "Guest", "operator"];
      const out = [
        "User accounts for \\\\" + (host?.hostname ?? "SERVER"),
        "-------------------------------------------------------------------------------",
        names.join("                 "),
        "The command completed successfully.",
      ];
      return { stdout: out.join("\n") + "\n", stderr: "", code: 0 };
    }
    if (argv[1] === "start") {
      const svcName = argv.slice(2).join(" ");
      const services = host?.windowsServices ?? [];
      const svc = services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());
      if (svc && (svc.unquotedPath || svc.canConfigure || svc.runAs === "LocalSystem" || svc.runAs === "NT AUTHORITY\\SYSTEM")) {
        nextState.currentUser = "Administrator";
        nextState.currentCwd = "C:\\Windows\\system32";
        return {
          stdout: `The ${svc.name} service is starting....\nThe ${svc.name} service was started successfully.\n[+] Elevated session spawned: NT AUTHORITY\\SYSTEM\n`,
          stderr: "",
          code: 0,
          nextState,
          prompt: formatPrompt(nextState, scenario),
        };
      }
      if (svc) {
        return { stdout: `The ${svc.name} service was started successfully.\n`, stderr: "", code: 0 };
      }
      return { stdout: "The service name is invalid.\n", stderr: "", code: 2 };
    }
  }

  // Windows sc command: sc qc, sc query, sc config, sc start
  if (cmd === "sc") {
    const sub = (argv[1] || "").toLowerCase();
    const svcName = argv[2] || "";
    const services = host?.windowsServices ?? [];
    const svc = services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());

    if (sub === "qc") {
      if (!svc) {
        return {
          stdout: `[SC] OpenService FAILED 1060:\n\nThe specified service does not exist as an installed service.\n`,
          stderr: "",
          code: 1,
        };
      }
      const out = [
        "[SC] QueryServiceConfig SUCCESS",
        "",
        `SERVICE_NAME: ${svc.name}`,
        "        TYPE               : 10  WIN32_OWN_PROCESS",
        `        START_TYPE         : ${svc.startType === "auto" ? "2   AUTO_START" : "3   DEMAND_START"}`,
        "        ERROR_CONTROL      : 1   NORMAL",
        `        BINARY_PATH_NAME   : ${svc.binPath}`,
        "        LOAD_ORDER_GROUP   :",
        "        TAG                : 0",
        `        DISPLAY_NAME       : ${svc.displayName ?? svc.name}`,
        "        DEPENDENCIES       :",
        `        SERVICE_START_NAME : ${svc.runAs ?? "LocalSystem"}`,
      ];
      return { stdout: out.join("\n") + "\n", stderr: "", code: 0 };
    }

    if (sub === "query") {
      const targetSvc = svcName ? svc : services[0];
      if (svcName && !svc) {
        return {
          stdout: `[SC] EnumQueryServicesStatus:OpenService FAILED 1060:\n\nThe specified service does not exist as an installed service.\n`,
          stderr: "",
          code: 1,
        };
      }
      if (targetSvc) {
        const out = [
          `SERVICE_NAME: ${targetSvc.name}`,
          `DISPLAY_NAME: ${targetSvc.displayName ?? targetSvc.name}`,
          "        TYPE               : 10  WIN32_OWN_PROCESS",
          `        STATE              : ${targetSvc.state === "STOPPED" ? "1  STOPPED" : "4  RUNNING"}`,
          "                                (STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)",
          "        WIN32_EXIT_CODE    : 0  (0x0)",
          "        SERVICE_EXIT_CODE  : 0  (0x0)",
          "        CHECKPOINT         : 0x0",
          "        WAIT_HINT          : 0x0",
        ];
        return { stdout: out.join("\n") + "\n", stderr: "", code: 0 };
      }
      return { stdout: "SERVICE_NAME: Spooler\n        STATE: 4  RUNNING\n", stderr: "", code: 0 };
    }

    if (sub === "config") {
      if (!svc) {
        return { stdout: "[SC] OpenService FAILED 1060:\n\nService not found.\n", stderr: "", code: 1 };
      }
      return { stdout: "[SC] ChangeServiceConfig SUCCESS\n", stderr: "", code: 0 };
    }

    if (sub === "start") {
      if (!svc) {
        return { stdout: `[SC] StartService: OpenService FAILED 1060\n`, stderr: "", code: 1 };
      }
      if (svc.unquotedPath || svc.canConfigure || svc.runAs === "LocalSystem" || svc.runAs === "NT AUTHORITY\\SYSTEM") {
        nextState.currentUser = "Administrator";
        nextState.currentCwd = "C:\\Windows\\system32";
        return {
          stdout: `[SC] StartService SUCCESS\n[+] Service '${svc.name}' executed with LocalSystem privileges.\n[+] Elevated session spawned: NT AUTHORITY\\SYSTEM\n`,
          stderr: "",
          code: 0,
          nextState,
          prompt: formatPrompt(nextState, scenario),
        };
      }
      return { stdout: `SERVICE_NAME: ${svc.name}\n        STATE              : 4  RUNNING\n`, stderr: "", code: 0 };
    }
  }

  // Windows wmic service
  if (cmd === "wmic") {
    if (argv.slice(1).join(" ").toLowerCase().includes("service")) {
      const services = host?.windowsServices ?? [];
      const lines = [
        "DisplayName                        Name           PathName                                                    StartMode",
        "=================================  =============  ==========================================================  =========",
      ];
      for (const s of services) {
        const dName = (s.displayName ?? s.name).padEnd(33);
        const name = s.name.padEnd(13);
        const path = s.binPath.padEnd(58);
        const start = s.startType === "auto" ? "Auto" : "Manual";
        lines.push(`${dName}  ${name}  ${path}  ${start}`);
      }
      return { stdout: lines.join("\n") + "\n", stderr: "", code: 0 };
    }
  }

  // Windows accesschk
  if (cmd === "accesschk" || cmd === "accesschk.exe") {
    const services = host?.windowsServices ?? [];
    const lines = ["AccessChk v6.12 - Check access rights of files, services, registry keys"];
    for (const s of services) {
      if (s.canConfigure || s.unquotedPath) {
        lines.push(`  RW ${s.name}`);
        lines.push("        SERVICE_ALL_ACCESS");
      }
    }
    return { stdout: lines.join("\n") + "\n", stderr: "", code: 0 };
  }

  // Windows copy
  if (cmd === "copy") {
    const src = argv[1];
    const dest = argv[2];
    if (!src || !dest) {
      return { stdout: "", stderr: "The syntax of the command is incorrect.\n", code: 1 };
    }
    return { stdout: "        1 file(s) copied.\n", stderr: "", code: 0 };
  }

  return {
    stdout: "",
    stderr: host?.os === "windows"
      ? `'${cmd}' is not recognized as an internal or external command, operable program or batch file.\n`
      : `bash: ${cmd}: command not found\n`,
    code: 127,
  };
}


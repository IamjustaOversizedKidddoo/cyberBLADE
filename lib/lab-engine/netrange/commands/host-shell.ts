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
      // Attacker machine files
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
      // Attacker machine files
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
    // Match exact path, or relative to cwd, or base filename
    const matchedPath = Object.keys(fs).find(
      (p) =>
        p === filename ||
        p === `${state.currentCwd}/${filename}` ||
        p.endsWith(`/${filename}`) ||
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
        sudoTargetCmd.includes(":!/bin/sh") ||
        sudoTargetCmd.includes(":!/bin/bash") ||
        sudoTargetCmd.includes("import os; os.system");

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
    if (line.includes("-perm -4000") || line.includes("-perm -u=s")) {
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

  // Windows net command: net user, net localgroup
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
  }

  return {
    stdout: "",
    stderr: host?.os === "windows"
      ? `'${cmd}' is not recognized as an internal or external command, operable program or batch file.\n`
      : `bash: ${cmd}: command not found\n`,
    code: 127,
  };
}

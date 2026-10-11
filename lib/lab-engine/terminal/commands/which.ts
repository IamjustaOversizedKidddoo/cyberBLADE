import type { Command } from "./types";
import { fail, ok } from "./util";

export const which: Command = {
  name: "which",
  summary: "locate a command",
  run(ctx) {
    const args = ctx.argv.slice(1);
    if (args.length === 0) return fail("which: missing argument\n");
    let stdout = "";
    let notFound = false;
    for (const cmd of args) {
      // Look up in known commands or standard binaries
      const standardBins = new Set([
        "cat", "cd", "chmod", "chown", "chgrp", "clear", "curl", "cut", "date", "dig",
        "echo", "env", "export", "file", "find", "grep", "groups", "head", "help",
        "history", "hostname", "id", "ip", "kill", "ls", "mkdir", "pgrep", "ping",
        "ps", "pwd", "sort", "ss", "stat", "strings", "su", "submit", "sudo",
        "systemctl", "tail", "touch", "tr", "traceroute", "umask", "uname", "uniq",
        "unset", "wc", "which", "whoami", "base64",
      ]);
      if (standardBins.has(cmd.toLowerCase())) {
        stdout += `/usr/bin/${cmd}\n`;
      } else {
        notFound = true;
      }
    }
    return notFound ? { stdout, stderr: `${args[0]}: not found\n`, code: 1 } : ok(stdout);
  },
};

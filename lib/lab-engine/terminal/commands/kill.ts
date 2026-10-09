import { SIGNALS } from "../processes";
import type { Command } from "./types";

function parseSignal(raw: string): number | null {
  const norm = raw.toUpperCase().replace(/^SIG/, "");
  if (/^\d+$/.test(norm)) {
    const n = parseInt(norm, 10);
    return n >= 1 && n <= 15 ? n : null;
  }
  const idx = SIGNALS.indexOf(norm);
  return idx !== -1 ? idx + 1 : null;
}

export const kill: Command = {
  name: "kill",
  summary: "send a signal to a process",
  run(ctx) {
    const args = ctx.argv.slice(1);

    if (args.length === 0) {
      return {
        stdout: "",
        stderr: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n",
        code: 2,
      };
    }

    if (args[0] === "-l") {
      return {
        stdout:
          " 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 4) SIGILL\t 5) SIGTRAP\n" +
          " 6) SIGABRT\t 7) SIGBUS\t 8) SIGFPE\t 9) SIGKILL\t10) SIGUSR1\n" +
          "11) SIGSEGV\t12) SIGUSR2\t13) SIGPIPE\t14) SIGALRM\t15) SIGTERM\n",
        stderr: "",
        code: 0,
      };
    }

    let signum = 15;
    const pidArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "-s" || arg === "-n") {
        i++;
        if (i < args.length) {
          const parsed = parseSignal(args[i]);
          if (parsed === null) {
            return { stdout: "", stderr: `bash: kill: ${args[i]}: invalid signal specification\n`, code: 1 };
          }
          signum = parsed;
        }
      } else if (arg.startsWith("-") && pidArgs.length === 0) {
        const raw = arg.slice(1);
        const parsed = parseSignal(raw);
        if (parsed === null) {
          return { stdout: "", stderr: `bash: kill: ${raw}: invalid signal specification\n`, code: 1 };
        }
        signum = parsed;
      } else {
        pidArgs.push(arg);
      }
    }

    if (pidArgs.length === 0) {
      return {
        stdout: "",
        stderr: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n",
        code: 2,
      };
    }

    let code = 0;
    let stderr = "";

    for (const p of pidArgs) {
      if (!/^-?\d+$/.test(p)) {
        stderr += `bash: kill: ${p}: arguments must be process or job IDs\n`;
        code = 1;
        continue;
      }

      const pid = parseInt(p, 10);
      const res = ctx.procs.kill(pid, signum, ctx.user);
      if (res === "ESRCH") {
        stderr += `bash: kill: (${pid}) - No such process\n`;
        code = 1;
      } else if (res === "EPERM") {
        stderr += `bash: kill: (${pid}) - Operation not permitted\n`;
        code = 1;
      } else if (res === "SHELL") {
        stderr += "kill: this lab keeps your shell running\n";
        code = 1;
      }
    }

    return { stdout: "", stderr, code };
  },
};

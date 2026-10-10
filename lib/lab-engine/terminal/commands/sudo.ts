import { groupsOf } from "../identity";
import { parseSudoers, rulesFor } from "../sudoers";
import type { Command } from "./types";
import { fail, ok } from "./util";

export const sudo: Command = {
  name: "sudo",
  summary: "execute a command as another user (root)",
  run(ctx) {
    const args = ctx.argv.slice(1);

    let sudoersText = "";
    try {
      sudoersText = ctx.vfs.readFile("/etc/sudoers", "root");
    } catch {
      // no sudoers file
    }

    const { defaults, rules } = parseSudoers(sudoersText);
    const userGroups = groupsOf(ctx.vfs, ctx.user);
    const userRules = rulesFor(rules, ctx.user, userGroups);

    const logAuth = (commandStr: string, commandNotAllowed = false) => {
      const reason = commandNotAllowed ? "command not allowed ; " : "";
      const line = `Oct  7 10:00:00 ${ctx.hostname} sudo: ${ctx.user} : ${reason}TTY=pts/0 ; PWD=${ctx.cwd} ; USER=root ; COMMAND=${commandStr}\n`;
      try {
        ctx.vfs.write("/var/log/auth.log", line, "root", true);
      } catch {
        // failed writing to auth.log
      }
    };

    if (args.length === 0 || args[0] === "-l") {
      logAuth("list");
      if (userRules.length === 0) {
        return fail(`Sorry, user ${ctx.user} may not run sudo on ${ctx.hostname}.\n`);
      }

      const ruleLines = userRules.map((r) => {
        const noPass = r.nopasswd ? " NOPASSWD:" : "";
        return `    (${r.runAs})${noPass} ${r.commands.join(", ")}`;
      });

      const out = [
        `Matching Defaults entries for ${ctx.user} on ${ctx.hostname}:`,
        `    ${defaults.join(", ")}`,
        "",
        `User ${ctx.user} may run the following commands on ${ctx.hostname}:`,
        ...ruleLines,
        "",
      ].join("\n");

      return ok(out);
    }

    const cmd = args[0];
    const cmdArgs = args.slice(1).join(" ");
    const fullPath = cmd.startsWith("/") ? cmd : `/usr/bin/${cmd}`;
    const commandStr = `${fullPath}${cmdArgs ? " " + cmdArgs : ""}`;

    const matchingRule = userRules.find((r) => {
      if (r.commands.includes("ALL")) return true;
      return r.commands.some((pat) => {
        if (pat === fullPath) return true;
        if (pat === commandStr) return true;
        if (pat.endsWith("*")) {
          const prefix = pat.slice(0, -1).trim();
          if (commandStr.startsWith(prefix)) return true;
        }
        return false;
      });
    });

    if (!matchingRule) {
      logAuth(commandStr, true);
      return fail(`Sorry, user ${ctx.user} is not allowed to execute '${commandStr}' as root on ${ctx.hostname}.\n`);
    }

    if (!matchingRule.nopasswd) {
      return fail("sudo: this lab can't ask for a password — only NOPASSWD commands from 'sudo -l' can run\n");
    }

    logAuth(commandStr, false);
    return ctx.runAs("root", [cmd, ...args.slice(1)]);
  },
};

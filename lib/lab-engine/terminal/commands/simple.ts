import type { Command } from "./types";
import { ok } from "./util";

export const whoami: Command = {
  name: "whoami",
  summary: "print your user name and security privileges",
  run(ctx) {
    const args = ctx.argv.slice(1);
    if (args.includes("/priv")) {
      return ok(
        "PRIVILEGES INFORMATION\n" +
          "----------------------\n\n" +
          "Privilege Name                Description                          State   \n" +
          "============================= ==================================== ========\n" +
          "SeChangeNotifyPrivilege       Bypass traverse checking             Enabled \n" +
          "SeSecurityPrivilege           Manage auditing and security log     Disabled\n" +
          "SeShutdownPrivilege           Shut down the system                 Disabled\n",
      );
    }
    if (args.includes("/groups")) {
      return ok(
        "GROUP INFORMATION\n" +
          "-----------------\n\n" +
          "Group Name                                  Type             SID          Attributes                                        \n" +
          "=========================================== ================ ============ ==================================================\n" +
          "Everyone                                    Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group\n" +
          "BUILTIN\\Users                               Alias            S-1-5-32-545 Mandatory group, Enabled by default, Enabled group\n",
      );
    }
    if (args.includes("/user")) {
      return ok(
        "USER INFORMATION\n" +
          "----------------\n\n" +
          "User Name       SID                                           \n" +
          "=============== ==============================================\n" +
          `${ctx.hostname}\\${ctx.user} S-1-5-21-1234567890-1234567890-1234567890-1000\n`,
      );
    }
    if (args.includes("/all")) {
      return ok(
        "USER INFORMATION\n" +
          "----------------\n\n" +
          "User Name       SID                                           \n" +
          "=============== ==============================================\n" +
          `${ctx.hostname}\\${ctx.user} S-1-5-21-1234567890-1234567890-1234567890-1000\n\n` +
          "GROUP INFORMATION\n" +
          "-----------------\n\n" +
          "Group Name                                  Type             SID          Attributes                                        \n" +
          "=========================================== ================ ============ ==================================================\n" +
          "Everyone                                    Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group\n" +
          "BUILTIN\\Users                               Alias            S-1-5-32-545 Mandatory group, Enabled by default, Enabled group\n\n" +
          "PRIVILEGES INFORMATION\n" +
          "----------------------\n\n" +
          "Privilege Name                Description                          State   \n" +
          "============================= ==================================== ========\n" +
          "SeChangeNotifyPrivilege       Bypass traverse checking             Enabled \n" +
          "SeSecurityPrivilege           Manage auditing and security log     Disabled\n" +
          "SeShutdownPrivilege           Shut down the system                 Disabled\n",
      );
    }
    return ok(`${ctx.user}\n`);
  },
};

export const hostname: Command = {
  name: "hostname",
  summary: "print this machine's name",
  run: (ctx) => ok(`${ctx.hostname}\n`),
};

export const clear: Command = {
  name: "clear",
  summary: "clear the screen",
  run: () => ({ ...ok(), clear: true }),
};

export const history: Command = {
  name: "history",
  summary: "list the commands you typed",
  run: (ctx) => ok(ctx.history.map((line, i) => `${String(i + 1).padStart(5)}  ${line}\n`).join("")),
};

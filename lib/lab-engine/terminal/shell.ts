import { COMMANDS, type CmdResult } from "./commands";
import { errorText } from "./commands/util";
import { expandGlobs, parseLine } from "./parser";
import type { World } from "./types";
import { resolvePath, Vfs } from "./vfs";

export type Shell = { exec(line: string): CmdResult; cwd(): string; prompt(): string };

export function createShell(world: World): Shell {
  const vfs = new Vfs(world.root);
  const { user, home, hostname } = world;
  const history: string[] = [];
  let cwd = home;
  const env: Record<string, string> = { ...world.env, HOME: home, USER: user, HOSTNAME: hostname, PWD: home };

  const setCwd = (path: string) => {
    env.OLDPWD = cwd;
    cwd = path;
    env.PWD = path;
  };

  function exec(line: string): CmdResult {
    if (line.trim()) history.push(line.trim());
    const parsed = parseLine(line, env);
    if ("error" in parsed) return { stdout: "", stderr: `bash: ${parsed.error}\n`, code: 2 };

    let stdin = "";
    let stderr = "";
    let last: CmdResult = { stdout: "", stderr: "", code: 0 };
    parsed.commands.forEach((command, index) => {
      const argv = expandGlobs(command.argv, cwd, vfs, home, { user, literal: command.literal });
      const redirect = command.redirect;
      const target = redirect ? resolvePath(cwd, redirect.path, home) : null;

      if (redirect && target) {
        // Like bash: open (create or truncate) the target before the command runs.
        try {
          vfs.write(target, "", user, redirect.op === ">>");
        } catch (err) {
          last = { stdout: "", stderr: `bash: ${redirect.path}: ${errorText(err)}\n`, code: 1 };
          stderr += last.stderr;
          stdin = "";
          return;
        }
      }

      // Own keys only: "toString" or "constructor" must not resolve to Object.prototype members.
      const impl = Object.hasOwn(COMMANDS, argv[0]) ? COMMANDS[argv[0]] : undefined;
      const isTty = index === parsed.commands.length - 1 && !redirect;
      const alone = parsed.commands.length === 1 && !redirect;
      last = impl
        ? impl.run({ argv, stdin, vfs, cwd, user, home, hostname, env, history, isTty, alone, network: world.network, setCwd })
        : { stdout: "", stderr: `${argv[0]}: command not found\n`, code: 127 };

      if (redirect && target) {
        try {
          vfs.write(target, last.stdout, user, true);
          last = { ...last, stdout: "" };
        } catch (err) {
          last = { stdout: "", stderr: last.stderr + `bash: ${redirect.path}: ${errorText(err)}\n`, code: 1 };
        }
      }
      stderr += last.stderr;
      stdin = last.stdout;
    });
    const result: CmdResult = { stdout: last.stdout, stderr, code: last.code };
    if (last.clear) result.clear = true;
    if (last.submit) result.submit = last.submit;
    return result;
  }

  const prompt = () => {
    const shown = cwd === home ? "~" : cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd;
    return `${user}@${hostname}:${shown}$ `;
  };

  return { exec, cwd: () => cwd, prompt };
}

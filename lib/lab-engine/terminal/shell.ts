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
    for (const command of parsed.commands) {
      const argv = expandGlobs(command.argv, cwd, vfs, home, { user, literal: command.literal });
      const impl = COMMANDS[argv[0]];
      last = impl
        ? impl.run({ argv, stdin, vfs, cwd, user, home, hostname, env, history, setCwd })
        : { stdout: "", stderr: `${argv[0]}: command not found\n`, code: 127 };

      if (command.redirect) {
        const { op, path } = command.redirect;
        try {
          vfs.write(resolvePath(cwd, path, home), last.stdout, user, op === ">>");
          last = { ...last, stdout: "" };
        } catch (err) {
          last = { stdout: "", stderr: last.stderr + `bash: ${path}: ${errorText(err)}\n`, code: 1 };
        }
      }
      stderr += last.stderr;
      stdin = last.stdout;
    }
    const result: CmdResult = { stdout: last.stdout, stderr, code: last.code };
    if (last.clear) result.clear = true;
    return result;
  }

  const prompt = () => {
    const shown = cwd === home ? "~" : cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd;
    return `${user}@${hostname}:${shown}$ `;
  };

  return { exec, cwd: () => cwd, prompt };
}

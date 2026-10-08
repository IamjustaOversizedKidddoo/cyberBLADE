import { COMMANDS, type CmdResult } from "./commands";
import { errorText } from "./commands/util";
import { readAccounts } from "./identity";
import { expandGlobs, parseLine } from "./parser";
import { ProcessTable } from "./processes";
import { procTree } from "./procfs";
import type { World } from "./types";
import { resolvePath, Vfs } from "./vfs";

/** Where a stream ends up: the screen/pipe, a file, or nowhere (/dev/null). */
type Sink = { kind: "default" } | { kind: "null" } | { kind: "file"; path: string; shown: string };

export type Shell = { exec(line: string): CmdResult; cwd(): string; prompt(): string };

export function createShell(world: World): Shell {
  const vfs = new Vfs(world.root, { umask: world.umask });
  const { user, home, hostname } = world;
  const history: string[] = [];
  let cwd = home;
  const env: Record<string, string> = { ...world.env, HOME: home, USER: user, HOSTNAME: hostname, PWD: home };
  const shellPid = world.shellPid ?? 2201;
  const procs = new ProcessTable(world.processes ?? [], shellPid, {
    pid: shellPid,
    ppid: world.shellParent ?? 1,
    user,
    argv: ["-bash"],
    state: "S",
    stat: "Ss",
    tty: "pts/0",
    start: "09:58",
    cpuTime: "0:00",
    cpu: 0,
    mem: 0.1,
    vsz: 8784,
    rss: 5376,
    env: { ...env },
  });
  vfs.mount("/proc", () =>
    procTree(procs, (name) => {
      const a = readAccounts(vfs).find((acc) => acc.name === name);
      return { uid: a?.uid ?? 0, gid: a?.gid ?? 0 };
    }),
  );

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
      const redirects = command.redirects ?? [];

      // Like bash: work out where stdout and stderr go, in the order written, and open (create or
      // truncate) every target file before the command runs.
      let out: Sink = { kind: "default" };
      let err: Sink = { kind: "default" };
      for (const r of redirects) {
        if ("toStdout" in r) {
          err = out;
          continue;
        }
        const path = resolvePath(cwd, r.path, home);
        const sink: Sink = path === "/dev/null" ? { kind: "null" } : { kind: "file", path, shown: r.path };
        if (sink.kind === "file") {
          try {
            vfs.write(path, "", user, r.op === ">>");
          } catch (e) {
            last = { stdout: "", stderr: `bash: ${r.path}: ${errorText(e)}\n`, code: 1 };
            stderr += last.stderr;
            stdin = "";
            return;
          }
        }
        if (r.fd === 1) out = sink;
        else err = sink;
      }

      // Own keys only: "toString" or "constructor" must not resolve to Object.prototype members.
      const impl = Object.hasOwn(COMMANDS, argv[0]) ? COMMANDS[argv[0]] : undefined;
      const isTty = index === parsed.commands.length - 1 && out.kind === "default";
      const alone = parsed.commands.length === 1 && redirects.length === 0;
      const ran = impl
        ? impl.run({ argv, stdin, vfs, cwd, user, home, hostname, env, history, isTty, alone, network: world.network, umask: vfs.umask, setUmask: (n) => (vfs.umask = n), procs, self: procs.spawnCommand(argv, user), setCwd })
        : { stdout: "", stderr: `${argv[0]}: command not found\n`, code: 127 };

      // Errors are written first: tools report a bad operand before (or instead of) its output.
      let toPipe = "";
      let toScreen = "";
      const send = (text: string, sink: Sink): string | null => {
        if (!text || sink.kind === "null") return null;
        if (sink.kind === "default") return text;
        try {
          vfs.write(sink.path, text, user, true);
        } catch (e) {
          toScreen += `bash: ${sink.shown}: ${errorText(e)}\n`;
        }
        return null;
      };
      const errText = send(ran.stderr, err);
      if (errText !== null) {
        // Default stderr goes to the screen — unless 2>&1 pointed it at a default stdout (the pipe).
        if (err === out) toPipe += errText;
        else toScreen += errText;
      }
      const outText = send(ran.stdout, out);
      if (outText !== null) toPipe += outText;

      last = { ...ran, stdout: toPipe, stderr: toScreen };
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

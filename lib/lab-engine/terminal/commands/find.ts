import { parseMode } from "../modes";
import type { Node } from "../types";
import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText } from "./util";

type Test = (node: Node, name: string) => boolean;

const glob = (pattern: string, flags = "") =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, flags);

/** -perm MODE (exact), -MODE (all of these bits), /MODE (any of these bits); octal or symbolic. */
function permTest(arg: string): Test | null {
  const kind = arg[0] === "-" || arg[0] === "/" ? arg[0] : "=";
  const mode = parseMode(kind === "=" ? arg : arg.slice(1), 0, { isDir: false, umask: 0 });
  if (mode === null) return null;
  if (kind === "-") return (n) => (n.mode & mode) === mode;
  if (kind === "/") return (n) => mode === 0 || (n.mode & mode) !== 0;
  return (n) => (n.mode & 0o7777) === mode;
}

/**
 * GNU find subset: paths, then -maxdepth N, -name, -iname, -type f|d, -perm, -user, -group (all ANDed).
 * Folders the user can't read are reported on stderr and skipped; the search carries on.
 */
export const find: Command = {
  name: "find",
  summary: "search for files: find / -name passwd, find / -perm -4000 2>/dev/null",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const paths: string[] = [];
    while (args.length && !args[0].startsWith("-")) paths.push(args.shift()!);
    const tests: Test[] = [];
    let maxDepth = Infinity;
    const err = (msg: string) => ({ stdout: "", stderr: `find: ${msg}\n`, code: 1 });

    while (args.length) {
      const flag = args.shift()!;
      const known = ["-maxdepth", "-name", "-iname", "-type", "-perm", "-user", "-group"];
      if (!known.includes(flag)) return err(`unknown predicate \`${flag}'`);
      const value = args.shift();
      if (value === undefined) return err(`missing argument to \`${flag}'`);
      if (flag === "-maxdepth") maxDepth = Number(value);
      else if (flag === "-name") tests.push((_, name) => glob(value).test(name));
      else if (flag === "-iname") tests.push((_, name) => glob(value, "i").test(name));
      else if (flag === "-type") {
        if (value !== "f" && value !== "d") return err(`Unknown argument to -type: ${value}`);
        tests.push((n) => n.kind === (value === "f" ? "file" : "dir"));
      } else if (flag === "-perm") {
        const t = permTest(value);
        if (!t) return err(`invalid mode \`${value}'`);
        tests.push(t);
      } else if (flag === "-user") tests.push((n) => n.owner === value);
      else tests.push((n) => n.group === value);
    }

    let stdout = "";
    let stderr = "";
    const visit = (abs: string, shown: string, node: Node, depth: number) => {
      const name = abs === "/" ? "/" : abs.slice(abs.lastIndexOf("/") + 1);
      if (tests.every((t) => t(node, name))) stdout += `${shown}\n`;
      if (node.kind !== "dir" || depth >= maxDepth) return;
      let entries: [string, Node][];
      try {
        entries = ctx.vfs.list(abs, ctx.user);
      } catch {
        stderr += `find: '${shown}': Permission denied\n`;
        return;
      }
      for (const [child, n] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        visit(abs === "/" ? `/${child}` : `${abs}/${child}`, shown.endsWith("/") ? `${shown}${child}` : `${shown}/${child}`, n, depth + 1);
      }
    };

    for (const p of paths.length ? paths : ["."]) {
      const abs = resolvePath(ctx.cwd, p, ctx.home);
      let node: Node;
      try {
        node = ctx.vfs.lookup(abs, ctx.user);
      } catch (e) {
        stderr += `find: '${p}': ${errorText(e)}\n`;
        continue;
      }
      visit(abs, p, node, 0);
    }
    return { stdout, stderr, code: stderr ? 1 : 0 };
  },
};

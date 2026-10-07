import { parseMode } from "../modes";
import { resolvePath } from "../vfs";
import { walkTree } from "./tree";
import type { Command } from "./types";
import { errorText } from "./util";

const TRY = "Try 'chmod --help' for more information.\n";

/** GNU chmod: octal or symbolic modes, -R. Only the owner (or root) may change a file's mode. */
export const chmod: Command = {
  name: "chmod",
  summary: "change permissions: chmod 640 file, chmod u+x file, chmod -R go-rwx dir",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const recurse = args[0] === "-R";
    const [spec, ...files] = recurse ? args.slice(1) : args;
    if (spec === undefined) return { stdout: "", stderr: `chmod: missing operand\n${TRY}`, code: 1 };
    if (files.length === 0) return { stdout: "", stderr: `chmod: missing operand after '${spec}'\n${TRY}`, code: 1 };
    if (parseMode(spec, 0, { isDir: false, umask: ctx.umask }) === null) {
      return { stdout: "", stderr: `chmod: invalid mode: '${spec}'\n${TRY}`, code: 1 };
    }
    let stderr = "";
    for (const name of files) {
      const path = resolvePath(ctx.cwd, name, ctx.home);
      try {
        ctx.vfs.lookup(path, ctx.user);
      } catch (err) {
        stderr += `chmod: cannot access '${name}': ${errorText(err)}\n`;
        continue;
      }
      for (const p of walkTree(ctx.vfs, path, recurse)) {
        const node = ctx.vfs.stat(p)!;
        const shown = p === path ? name : `${name}${p.slice(path.length)}`;
        if (ctx.user !== "root" && node.owner !== ctx.user) {
          stderr += `chmod: changing permissions of '${shown}': Operation not permitted\n`;
          continue;
        }
        ctx.vfs.setMode(p, parseMode(spec, node.mode, { isDir: node.kind === "dir", umask: ctx.umask })!);
      }
    }
    return { stdout: "", stderr, code: stderr ? 1 : 0 };
  },
};

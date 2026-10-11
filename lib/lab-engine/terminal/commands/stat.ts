import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText } from "./util";

export const stat: Command = {
  name: "stat",
  summary: "display file or file system status",
  run(ctx) {
    const args = ctx.argv.slice(1).filter((a) => !a.startsWith("-"));
    if (args.length === 0) {
      return { stdout: "", stderr: "stat: missing operand\n", code: 1 };
    }

    let stdout = "";
    for (const f of args) {
      const fullPath = resolvePath(ctx.cwd, f, ctx.home);
      try {
        const node = ctx.vfs.stat(fullPath);
        if (!node) {
          return { stdout: "", stderr: `stat: cannot statx '${f}': No such file or directory\n`, code: 1 };
        }
        const octalMode = (node.mode & 0o7777).toString(8).padStart(4, "0");
        const isDir = node.kind === "dir";
        const typeStr = isDir ? "directory" : "regular file";
        const size = node.kind === "file" ? new TextEncoder().encode(node.content).length : 4096;
        stdout += `  File: ${f}\n  Size: ${size}       \tBlocks: 8          IO Block: 4096   ${typeStr}\nAccess: (${octalMode}/-rw-r--r--)  Uid: ( 1000/   ${node.owner})   Gid: ( 1000/   ${node.group})\n`;
      } catch (err) {
        return { stdout: "", stderr: `stat: cannot statx '${f}': ${errorText(err)}\n`, code: 1 };
      }
    }

    return { stdout, stderr: "", code: 0 };
  },
};

import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText } from "./util";

export const file: Command = {
  name: "file",
  summary: "determine file type",
  run(ctx) {
    const args = ctx.argv.slice(1).filter((a) => !a.startsWith("-"));
    if (args.length === 0) {
      return { stdout: "", stderr: "Usage: file [-bcikL] [file...]\n", code: 1 };
    }

    let stdout = "";
    for (const f of args) {
      const fullPath = resolvePath(ctx.cwd, f, ctx.home);
      try {
        const node = ctx.vfs.stat(fullPath);
        if (!node) {
          stdout += `${f}: cannot open (No such file or directory)\n`;
          continue;
        }
        if (node.kind === "dir") {
          stdout += `${f}: directory\n`;
        } else {
          const content = ctx.vfs.readFile(fullPath, ctx.user);
          if (content.length === 0) {
            stdout += `${f}: empty\n`;
          } else if (content.startsWith("#!/bin/") || content.startsWith("#!/usr/bin/")) {
            stdout += `${f}: POSIX shell script, ASCII text executable\n`;
          } else if ((node.mode & 0o111) !== 0) {
            stdout += `${f}: ELF 64-bit LSB pie executable, x86-64\n`;
          } else {
            stdout += `${f}: ASCII text\n`;
          }
        }
      } catch (err) {
        stdout += `${f}: cannot open (${errorText(err)})\n`;
      }
    }

    return { stdout, stderr: "", code: 0 };
  },
};

import type { Command } from "./types";
import { ok } from "./util";

export const pwd: Command = {
  name: "pwd",
  summary: "print the folder you are in",
  run: (ctx) => ok(`${ctx.cwd}\n`),
};

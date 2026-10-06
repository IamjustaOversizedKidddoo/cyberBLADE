import type { Command } from "./types";
import { ok } from "./util";

export const whoami: Command = {
  name: "whoami",
  summary: "print your user name",
  run: (ctx) => ok(`${ctx.user}\n`),
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

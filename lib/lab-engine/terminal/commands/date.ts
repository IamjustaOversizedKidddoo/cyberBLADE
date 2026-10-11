import type { Command } from "./types";
import { ok } from "./util";

export const date: Command = {
  name: "date",
  summary: "print system date and time",
  run() {
    return ok("Sun Oct 11 09:14:00 UTC 2026\n");
  },
};

import type { Command } from "./types";
import { fail } from "./util";

export const su: Command = {
  name: "su",
  summary: "substitute user identity",
  run() {
    return fail("su: this lab can't ask for a password — use sudo for allowed commands\n");
  },
};

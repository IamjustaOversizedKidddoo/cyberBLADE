import { parseMode } from "../modes";
import type { Command } from "./types";
import { fail, ok } from "./util";

const symbolic = (umask: number) => {
  const allowed = ~umask & 0o777;
  const part = (shift: number) => ["r", "w", "x"].filter((_, i) => allowed & (4 >> i) << shift).join("");
  return `u=${part(6)},g=${part(3)},o=${part(0)}`;
};

/** bash `umask`: show or set the bits removed from new files' permissions. */
export const umask: Command = {
  name: "umask",
  summary: "show or set default permissions for new files: umask, umask 077",
  run(ctx) {
    const arg = ctx.argv[1];
    if (arg === undefined) return ok(`${ctx.umask.toString(8).padStart(4, "0")}\n`);
    if (arg === "-S") return ok(`${symbolic(ctx.umask)}\n`);
    let next: number;
    if (/^[0-7]{1,4}$/.test(arg)) next = parseInt(arg, 8) & 0o777;
    else if (/^\d+$/.test(arg)) return fail(`bash: umask: ${arg}: octal number out of range\n`);
    else {
      // Symbolic umask names the permissions to KEEP: u=rwx,g=rx,o= → umask 027.
      const kept = parseMode(arg, ~ctx.umask & 0o777, { isDir: true, umask: 0 });
      if (kept === null) return fail(`bash: umask: \`${arg[0]}': invalid symbolic mode operator\n`);
      next = ~kept & 0o777;
    }
    // In a pipeline bash runs this in a subshell, so nothing changes.
    if (ctx.alone) ctx.setUmask(next);
    return ok();
  },
};

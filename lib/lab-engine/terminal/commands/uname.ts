import { KERNEL } from "../sysinfo";
import type { Command } from "./types";
import { fail, ok, parseFlags } from "./util";

/** coreutils uname: -s kernel name, -n host, -r release, -v version, -m machine, -a all. */
export const uname: Command = {
  name: "uname",
  summary: "show the kernel and machine: uname -a",
  run(ctx) {
    const { flags, bad } = parseFlags(ctx.argv.slice(1), "asnrvm");
    if (bad) return fail(`uname: invalid option -- '${bad}'\nTry 'uname --help' for more information.\n`);
    const fields: [string, string][] = [
      ["s", KERNEL.name],
      ["n", ctx.hostname],
      ["r", KERNEL.release],
      ["v", KERNEL.version],
      ["m", KERNEL.machine],
    ];
    if (flags.has("a")) return ok(`${fields.map(([, v]) => v).join(" ")} ${KERNEL.machine} ${KERNEL.machine} GNU/Linux\n`);
    const chosen = fields.filter(([f]) => flags.has(f)).map(([, v]) => v);
    return ok(`${(chosen.length ? chosen : [KERNEL.name]).join(" ")}\n`);
  },
};

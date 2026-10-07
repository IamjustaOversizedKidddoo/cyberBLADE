import type { Command } from "./types";
import { fail, ok } from "./util";

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** coreutils env with no arguments: the environment, one NAME=value per line. */
export const env: Command = {
  name: "env",
  summary: "show environment variables",
  run(ctx) {
    if (ctx.argv.length > 1) return fail("env: this lab only runs env with no arguments\n");
    return ok(Object.entries(ctx.env).map(([k, v]) => `${k}=${v}\n`).join(""));
  },
};

/** bash export. In a pipeline bash runs it in a subshell, so it changes nothing. */
export const exportCmd: Command = {
  name: "export",
  summary: "set an environment variable: export NAME=value",
  run(ctx) {
    const args = ctx.argv.slice(1).filter((a) => a !== "-p");
    if (args.length === 0) {
      const names = Object.keys(ctx.env).sort();
      return ok(names.map((n) => `declare -x ${n}="${ctx.env[n]}"\n`).join(""));
    }
    let stderr = "";
    for (const arg of args) {
      const eq = arg.indexOf("=");
      const name = eq === -1 ? arg : arg.slice(0, eq);
      if (!NAME.test(name)) {
        stderr += `bash: export: \`${arg}': not a valid identifier\n`;
        continue;
      }
      if (ctx.alone && eq !== -1) ctx.env[name] = arg.slice(eq + 1);
    }
    return { stdout: "", stderr, code: stderr ? 1 : 0 };
  },
};

/** bash unset. */
export const unset: Command = {
  name: "unset",
  summary: "remove an environment variable: unset NAME",
  run(ctx) {
    if (ctx.alone) for (const name of ctx.argv.slice(1)) delete ctx.env[name];
    return ok();
  },
};

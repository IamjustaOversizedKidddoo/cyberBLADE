import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, fail, ok } from "./util";

export const cd: Command = {
  name: "cd",
  summary: "change folder (cd .. goes up, cd alone goes home)",
  run(ctx) {
    const args = ctx.argv.slice(1);
    if (args.length > 1) return fail("bash: cd: too many arguments\n");
    const arg = args[0];
    let target = arg ?? ctx.home;
    if (arg === "-") {
      if (!ctx.env.OLDPWD) return fail("bash: cd: OLDPWD not set\n");
      target = ctx.env.OLDPWD;
    }
    const path = resolvePath(ctx.cwd, target, ctx.home);
    try {
      ctx.vfs.checkDir(path, ctx.user);
    } catch (err) {
      return fail(`bash: cd: ${arg}: ${errorText(err)}\n`);
    }
    ctx.setCwd(path);
    return ok(arg === "-" ? `${path}\n` : "");
  },
};

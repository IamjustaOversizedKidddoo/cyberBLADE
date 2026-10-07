import { readAccounts, readGroups } from "../identity";
import { resolvePath } from "../vfs";
import { walkTree } from "./tree";
import type { CmdContext, CmdResult, Command } from "./types";
import { errorText } from "./util";

type Change = { owner?: string; group?: string };

/** Applies an ownership change to each file; `allowed` decides per node, like the kernel would. */
function apply(ctx: CmdContext, tool: string, verb: string, change: Change, files: string[], recurse: boolean, allowed: (owner: string) => boolean): CmdResult {
  let stderr = "";
  for (const name of files) {
    const path = resolvePath(ctx.cwd, name, ctx.home);
    try {
      ctx.vfs.lookup(path, ctx.user);
    } catch (err) {
      stderr += `${tool}: cannot access '${name}': ${errorText(err)}\n`;
      continue;
    }
    for (const p of walkTree(ctx.vfs, path, recurse)) {
      const node = ctx.vfs.stat(p)!;
      const shown = p === path ? name : `${name}${p.slice(path.length)}`;
      if (!allowed(node.owner)) {
        stderr += `${tool}: changing ${verb} of '${shown}': Operation not permitted\n`;
        continue;
      }
      ctx.vfs.setOwner(p, change.owner, change.group);
      // Like Linux: a new owner or group on a regular file drops its setuid/setgid bits.
      if (node.kind === "file") ctx.vfs.setMode(p, node.mode & ~0o6000);
    }
  }
  return { stdout: "", stderr, code: stderr ? 1 : 0 };
}

function operands(ctx: CmdContext) {
  const args = ctx.argv.slice(1);
  const recurse = args[0] === "-R";
  const [spec, ...files] = recurse ? args.slice(1) : args;
  return { recurse, spec, files };
}

const missing = (tool: string, spec?: string): CmdResult => ({
  stdout: "",
  stderr: `${tool}: missing operand${spec ? ` after '${spec}'` : ""}\nTry '${tool} --help' for more information.\n`,
  code: 1,
});

/** GNU chown USER[:GROUP] / :GROUP. On Linux only root may give a file away. */
export const chown: Command = {
  name: "chown",
  summary: "change the owner (root only): chown user:group file",
  run(ctx) {
    const { recurse, spec, files } = operands(ctx);
    if (spec === undefined || files.length === 0) return missing("chown", spec);
    const [owner, group] = spec.split(":");
    if (owner && !readAccounts(ctx.vfs).some((a) => a.name === owner)) return { stdout: "", stderr: `chown: invalid user: '${spec}'\n`, code: 1 };
    if (group && !readGroups(ctx.vfs).some((g) => g.name === group)) return { stdout: "", stderr: `chown: invalid group: '${spec}'\n`, code: 1 };
    return apply(ctx, "chown", "ownership", { owner: owner || undefined, group: group || undefined }, files, recurse, () => ctx.user === "root");
  },
};

/** GNU chgrp: the owner may choose any group they belong to; root may choose any group. */
export const chgrp: Command = {
  name: "chgrp",
  summary: "change a file's group: chgrp group file",
  run(ctx) {
    const { recurse, spec, files } = operands(ctx);
    if (spec === undefined || files.length === 0) return missing("chgrp", spec);
    if (!readGroups(ctx.vfs).some((g) => g.name === spec)) return { stdout: "", stderr: `chgrp: invalid group: '${spec}'\n`, code: 1 };
    const member = ctx.vfs.groupsOf(ctx.user).includes(spec);
    return apply(ctx, "chgrp", "group", { group: spec }, files, recurse, (owner) => ctx.user === "root" || (owner === ctx.user && member));
  },
};

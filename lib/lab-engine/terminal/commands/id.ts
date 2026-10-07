import { readAccounts, readGroups } from "../identity";
import type { Command } from "./types";
import { fail, ok } from "./util";

/** coreutils `id [user]`: numeric ids with names, from /etc/passwd and /etc/group. */
export const id: Command = {
  name: "id",
  summary: "show your user id and groups: id, id <user>",
  run(ctx) {
    const name = ctx.argv[1] ?? ctx.user;
    const account = readAccounts(ctx.vfs).find((a) => a.name === name);
    if (!account) return fail(`id: '${name}': no such user\n`);
    const gidOf = new Map(readGroups(ctx.vfs).map((g) => [g.name, g.gid]));
    const groups = ctx.vfs.groupsOf(name).map((g) => `${gidOf.get(g)}(${g})`);
    const primary = readGroups(ctx.vfs).find((g) => g.gid === account.gid);
    const gid = primary ? `${account.gid}(${primary.name})` : String(account.gid);
    return ok(`uid=${account.uid}(${name}) gid=${gid} groups=${groups.length ? groups.join(",") : gid}\n`);
  },
};

import { readAccounts } from "../identity";
import type { Command } from "./types";
import { fail, ok } from "./util";

/** coreutils `groups [user]`: group names; with a user, prefixed by "user : ". */
export const groups: Command = {
  name: "groups",
  summary: "list the groups you (or a user) belong to",
  run(ctx) {
    const name = ctx.argv[1];
    const who = name ?? ctx.user;
    if (!readAccounts(ctx.vfs).some((a) => a.name === who)) return fail(`groups: '${who}': no such user\n`);
    const list = ctx.vfs.groupsOf(who).join(" ");
    return ok(name ? `${name} : ${list}\n` : `${list}\n`);
  },
};

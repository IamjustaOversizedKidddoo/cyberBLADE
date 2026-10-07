import type { Vfs } from "./vfs";

export type Account = { name: string; uid: number; gid: number; home: string; shell: string };
export type Group = { name: string; gid: number; members: string[] };

/** Lines of a file read the way the OS itself does: no permission check (it runs as root). */
function rows(vfs: Vfs, path: string): string[][] {
  const node = vfs.stat(path);
  if (!node || node.kind !== "file") return [];
  return node.content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split(":"));
}

/** /etc/passwd: name:x:uid:gid:gecos:home:shell */
export function readAccounts(vfs: Vfs): Account[] {
  return rows(vfs, "/etc/passwd").map(([name, , uid, gid, , home = "", shell = ""]) => ({
    name,
    uid: Number(uid),
    gid: Number(gid),
    home,
    shell,
  }));
}

/** /etc/group: name:x:gid:member,member */
export function readGroups(vfs: Vfs): Group[] {
  return rows(vfs, "/etc/group").map(([name, , gid, members = ""]) => ({
    name,
    gid: Number(gid),
    members: members.split(",").filter(Boolean),
  }));
}

/** The user's groups: primary group (from the passwd gid) first, then supplementary ones in file order. */
export function groupsOf(vfs: Vfs, user: string): string[] {
  const account = readAccounts(vfs).find((a) => a.name === user);
  const groups = readGroups(vfs);
  const primary = account ? groups.find((g) => g.gid === account.gid)?.name : undefined;
  const out = primary ? [primary] : [];
  for (const g of groups) if (g.members.includes(user) && !out.includes(g.name)) out.push(g.name);
  return out;
}

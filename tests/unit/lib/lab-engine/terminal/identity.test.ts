import { dir, file } from "@/lib/lab-engine/terminal/build";
import { groupsOf, readAccounts, readGroups } from "@/lib/lab-engine/terminal/identity";
import { Vfs } from "@/lib/lab-engine/terminal/vfs";

import { GROUP, PASSWD } from "./fixture-identity";

const vfsWith = (etc: Record<string, string>) =>
  new Vfs(dir({ etc: dir(Object.fromEntries(Object.entries(etc).map(([k, v]) => [k, file(v, { mode: 0o600 })]))) }));

test("reads accounts and groups from /etc, even when the files are not readable by the user", () => {
  const vfs = vfsWith({ passwd: PASSWD, group: GROUP });
  expect(readAccounts(vfs)[1]).toEqual({ name: "op", uid: 1000, gid: 1000, home: "/home/op", shell: "/bin/bash" });
  expect(readGroups(vfs).find((g) => g.name === "sudo")).toEqual({ name: "sudo", gid: 27, members: ["op", "bob"] });
});

test("groupsOf: primary group first, then supplementary groups in /etc/group order", () => {
  const vfs = vfsWith({ passwd: PASSWD, group: GROUP });
  expect(groupsOf(vfs, "op")).toEqual(["op", "adm", "sudo"]);
  expect(groupsOf(vfs, "bob")).toEqual(["bob", "sudo", "docker"]);
  expect(groupsOf(vfs, "root")).toEqual(["root"]);
});

test("missing files mean no accounts; an unknown user has no groups", () => {
  const vfs = vfsWith({});
  expect(readAccounts(vfs)).toEqual([]);
  expect(readGroups(vfs)).toEqual([]);
  expect(groupsOf(vfs, "ghost")).toEqual([]);
});

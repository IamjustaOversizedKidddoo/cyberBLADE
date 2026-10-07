import { dir, file } from "@/lib/lab-engine/terminal/build";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import { GROUP, PASSWD } from "../fixture-identity";

const sh = () =>
  createShell({ hostname: "h", user: "op", home: "/home/op", root: dir({ etc: dir({ passwd: file(PASSWD), group: file(GROUP) }), home: dir({ op: dir({}, { owner: "op" }) }) }) });

test("id shows uid, gid and every group with numbers and names", () => {
  expect(sh().exec("id")).toEqual({ stdout: "uid=1000(op) gid=1000(op) groups=1000(op),4(adm),27(sudo)\n", stderr: "", code: 0 });
  expect(sh().exec("id bob").stdout).toBe("uid=1001(bob) gid=1001(bob) groups=1001(bob),27(sudo),999(docker)\n");
  expect(sh().exec("id root").stdout).toBe("uid=0(root) gid=0(root) groups=0(root)\n");
});

test("id of an unknown user", () => {
  expect(sh().exec("id ghost")).toEqual({ stdout: "", stderr: "id: 'ghost': no such user\n", code: 1 });
});

test("groups lists names; with a user it prefixes the user", () => {
  expect(sh().exec("groups").stdout).toBe("op adm sudo\n");
  expect(sh().exec("groups bob").stdout).toBe("bob : bob sudo docker\n");
  expect(sh().exec("groups ghost")).toEqual({ stdout: "", stderr: "groups: 'ghost': no such user\n", code: 1 });
});

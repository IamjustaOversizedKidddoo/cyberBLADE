import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { World } from "@/lib/lab-engine/terminal/types";
import { GROUP, PASSWD } from "./fixture-identity";

/** A machine for permission-command tests: user "op" (groups op, adm, sudo) or root. */
export function permWorld(user = "op"): World {
  const op = { owner: "op", group: "op" };
  return {
    hostname: "h",
    user,
    home: user === "root" ? "/root" : "/home/op",
    root: dir({
      etc: dir({ passwd: file(PASSWD), group: file(GROUP) }),
      home: dir({
        op: dir(
          {
            "run.sh": file("echo hi\n", op),
            "locked.txt": file("secret\n", { ...op, mode: 0o000 }),
            project: dir({ "a.txt": file("a\n", op), sub: dir({ "b.txt": file("b\n", op) }, op) }, op),
          },
          op,
        ),
      }),
      root: dir({}, { mode: 0o700 }),
      usr: dir({ bin: dir({ tool: file("", { mode: 0o4755 }) }) }),
    }),
  };
}

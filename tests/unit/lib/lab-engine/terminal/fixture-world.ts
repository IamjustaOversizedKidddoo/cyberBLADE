import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { World } from "@/lib/lab-engine/terminal/types";

/** Small realistic machine used by the terminal engine tests. User "op", host "neon-lab". */
export function fixtureWorld(): World {
  const op = { owner: "op", group: "op" };
  return {
    hostname: "neon-lab",
    user: "op",
    home: "/home/op",
    env: { PATH: "/usr/bin:/bin" },
    root: dir({
      etc: dir({ hostname: file("neon-lab\n"), passwd: file("root:x:0:0:root:/root:/bin/bash\nop:x:1000:1000:op:/home/op:/bin/bash\n") }),
      home: dir({
        op: dir(
          {
            "notes.txt": file("buy milk\ncheck logs\n", op),
            ".hidden": file("secret stuff\n", op),
            Docs: dir({ "plan.md": file("# plan\n", op) }, op),
          },
          op,
        ),
      }),
      root: dir({ secret: file("root only\n", { mode: 0o600 }) }, { mode: 0o700 }),
      srv: dir({ locked: dir({ "known.txt": file("you found me\n") }, { mode: 0o711 }) }),
      tmp: dir({}, { mode: 0o777 }),
      var: dir({
        log: dir({
          "auth.log": file(
            "Oct  6 09:00:01 neon-lab sshd[101]: Failed password for root from 10.0.0.5\n" +
              "Oct  6 09:00:02 neon-lab sshd[101]: Failed password for root from 10.0.0.5\n" +
              "Oct  6 09:00:03 neon-lab sshd[102]: Accepted password for op from 10.0.0.9\n" +
              "Oct  6 09:00:04 neon-lab sshd[103]: Failed password for admin from 10.0.0.7\n",
          ),
          "sys.log": file("boot ok\n"),
          "app.txt": file("not a log\n"),
        }),
      }),
    }),
  };
}

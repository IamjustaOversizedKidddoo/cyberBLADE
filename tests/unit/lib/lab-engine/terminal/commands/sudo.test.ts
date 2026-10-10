import { dir, file } from "@/lib/lab-engine/terminal/build";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";
import { PASSWD, GROUP } from "../fixture-identity";

const SUDOERS_CONTENT = `
Defaults env_reset, mail_badpass, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin", use_pty

root ALL=(ALL:ALL) ALL
op ALL=(root) NOPASSWD: /usr/bin/cat, /usr/bin/whoami
alice ALL=(root) /usr/bin/cat
`;

function sudoWorld(user = "op"): World {
  const op = { owner: "op", group: "op" };
  return {
    hostname: "neon-lab",
    user,
    home: user === "root" ? "/root" : `/home/${user}`,
    root: dir({
      etc: dir({
        passwd: file(PASSWD),
        group: file(GROUP),
        sudoers: file(SUDOERS_CONTENT, { mode: 0o440, owner: "root", group: "root" }),
        shadow: file("root:$6$xyz:19000:0:99999:7:::\n", { mode: 0o640, owner: "root", group: "shadow" }),
      }),
      home: dir({
        op: dir({}, op),
      }),
      var: dir({
        log: dir({}),
      }),
    }),
  };
}

test("sudo -l prints matching defaults and user rules", () => {
  const s = createShell(sudoWorld("op"));
  const out = s.exec("sudo -l");
  expect(out.code).toBe(0);
  expect(out.stdout).toBe(
    "Matching Defaults entries for op on neon-lab:\n" +
      '    env_reset, mail_badpass, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin", use_pty\n\n' +
      "User op may run the following commands on neon-lab:\n" +
      "    (root) NOPASSWD: /usr/bin/cat, /usr/bin/whoami\n",
  );

  const bobShell = createShell(sudoWorld("bob"));
  expect(bobShell.exec("sudo -l")).toEqual({
    stdout: "",
    stderr: "Sorry, user bob may not run sudo on neon-lab.\n",
    code: 1,
  });
});

test("sudo executes allowed command as root and appends to /var/log/auth.log", () => {
  const s = createShell(sudoWorld("op"));
  const out = s.exec("sudo cat /etc/shadow");
  expect(out.code).toBe(0);
  expect(out.stdout).toContain("root:$6$xyz");

  const who = s.exec("sudo whoami");
  expect(who).toEqual({ stdout: "root\n", stderr: "", code: 0 });

  const authLog = s.exec("sudo cat /var/log/auth.log");
  expect(authLog.stdout).toContain(
    "Oct  7 10:00:00 neon-lab sudo: op : TTY=pts/0 ; PWD=/home/op ; USER=root ; COMMAND=/usr/bin/cat /etc/shadow\n",
  );
  expect(authLog.stdout).toContain(
    "Oct  7 10:00:00 neon-lab sudo: op : TTY=pts/0 ; PWD=/home/op ; USER=root ; COMMAND=/usr/bin/whoami\n",
  );
});

test("sudo refuses commands requiring password or unlisted commands", () => {
  const alice = createShell(sudoWorld("alice"));
  expect(alice.exec("sudo cat /etc/shadow")).toEqual({
    stdout: "",
    stderr: "sudo: this lab can't ask for a password — only NOPASSWD commands from 'sudo -l' can run\n",
    code: 1,
  });

  const op = createShell(sudoWorld("op"));
  expect(op.exec("sudo ls /root")).toEqual({
    stdout: "",
    stderr: "Sorry, user op is not allowed to execute '/usr/bin/ls /root' as root on neon-lab.\n",
    code: 1,
  });

  const authLog = op.exec("sudo cat /var/log/auth.log");
  expect(authLog.stdout).toContain(
    "Oct  7 10:00:00 neon-lab sudo: op : command not allowed ; TTY=pts/0 ; PWD=/home/op ; USER=root ; COMMAND=/usr/bin/ls /root\n",
  );
});

test("sudo -l with redirect still writes to file and logs to auth.log", () => {
  const s = createShell(sudoWorld("op"));
  const res = s.exec("sudo -l > /home/op/out.txt");
  expect(res.code).toBe(0);
  expect(s.exec("cat /home/op/out.txt").stdout).toContain("User op may run");

  const log = s.exec("sudo cat /var/log/auth.log");
  expect(log.stdout).toContain("COMMAND=list");
});

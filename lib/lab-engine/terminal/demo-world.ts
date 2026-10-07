import { dir, file } from "./build";
import type { World } from "./types";

/**
 * The machine lesson examples run against (```console blocks in lessons without their own lab).
 * Outputs shown in lessons should match what these files produce.
 */
export function demoWorld(): World {
  const me = { owner: "learner" };
  return {
    hostname: "neon-demo",
    user: "learner",
    home: "/home/learner",
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", SHELL: "/bin/bash", LANG: "en_IN.UTF-8" },
    root: dir({
      etc: dir({
        hostname: file("neon-demo\n"),
        "os-release": file('NAME="Ubuntu"\nVERSION="24.04 LTS (Noble Numbat)"\nID=ubuntu\n'),
        passwd: file(
          "root:x:0:0:root:/root:/bin/bash\n" +
            "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n" +
            "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n" +
            "learner:x:1000:1000:Learner:/home/learner:/bin/bash\n",
        ),
        shadow: file("root:*:19700:0:99999:7:::\nlearner:$y$j9T$demo$hash:19700:0:99999:7:::\n", { mode: 0o640, group: "shadow" }),
      }),
      home: dir({
        learner: dir(
          {
            ".bashrc": file("# ~/.bashrc\nalias ll='ls -la'\n", me),
            "notes.txt": file("Remember: only test systems you own.\nRead the logs every morning.\n", me),
            Documents: dir({ "report.txt": file("Quarterly report draft\n", me) }, me),
            Downloads: dir({}, me),
          },
          { ...me, mode: 0o750 },
        ),
      }),
      root: dir({ ".bash_history": file("apt update\n", { mode: 0o600 }) }, { mode: 0o700 }),
      tmp: dir({}, { mode: 0o777 }),
      var: dir({
        log: dir({
          "auth.log": file(
            "Oct  6 08:58:12 neon-demo sshd[812]: Accepted publickey for learner from 192.168.1.20 port 51514 ssh2\n" +
              "Oct  6 09:02:41 neon-demo sshd[851]: Failed password for root from 203.0.113.7 port 40122 ssh2\n" +
              "Oct  6 09:02:44 neon-demo sshd[851]: Failed password for root from 203.0.113.7 port 40122 ssh2\n" +
              "Oct  6 09:02:47 neon-demo sshd[851]: Failed password for invalid user admin from 203.0.113.7 port 40130 ssh2\n" +
              "Oct  6 09:15:03 neon-demo sudo:  learner : TTY=pts/0 ; PWD=/home/learner ; USER=root ; COMMAND=/usr/bin/apt update\n",
            { mode: 0o644, group: "adm" },
          ),
          syslog: file("Oct  6 08:55:00 neon-demo systemd[1]: Started Daily apt download activities.\n", { group: "adm" }),
        }),
      }),
    }),
  };
}

import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { DirNode, Node, World } from "@/lib/lab-engine/terminal/types";
import type { Rng } from "../rng";

/** Indian and international first names, all lowercase usernames, none a substring of another. */
export const USERNAMES = [
  "aarav",
  "priya",
  "rohan",
  "ananya",
  "vikram",
  "meera",
  "kabir",
  "kavya",
  "samira",
  "lena",
  "omar",
  "yuki",
  "diego",
  "nina",
  "tariq",
  "ishaan",
] as const;

const HOST_WORDS = ["ops", "vault", "relay", "grid", "harbor", "beacon", "summit", "orbit"] as const;

export function pickHostname(rng: Rng): string {
  return `neon-${rng.pick(HOST_WORDS)}-${String(rng.int(1, 99)).padStart(2, "0")}`;
}

/** Distinct usernames, the first one being the learner. */
export function pickUsers(rng: Rng, count: number): string[] {
  return rng.shuffle(USERNAMES).slice(0, count);
}

export function pickIp(rng: Rng, prefix = "10.20"): string {
  return `${prefix}.${rng.int(0, 254)}.${rng.int(1, 254)}`;
}

type BaseOptions = {
  user: string;
  hostname: string;
  otherUsers?: string[];
  home?: Record<string, Node>;
  homeMode?: number;
  etc?: Record<string, Node>;
  log?: Record<string, Node>;
  extra?: Record<string, Node>;
};

/** A realistic small Linux machine: /etc, /home/<user>, /var/log, /tmp. Callers add the lab's files. */
export function baseWorld(opts: BaseOptions): World {
  const { user, hostname, otherUsers = [] } = opts;
  const all = [user, ...otherUsers];
  const passwd =
    "root:x:0:0:root:/root:/bin/bash\n" +
    "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n" +
    all.map((u, i) => `${u}:x:${1000 + i}:${1000 + i}:${u}:/home/${u}:/bin/bash\n`).join("");

  const homes: Record<string, DirNode> = {
    [user]: dir(
      {
        ".bashrc": file("# ~/.bashrc: executed by bash for interactive shells\nalias ll='ls -la'\n", { owner: user }),
        ".profile": file("# ~/.profile\n", { owner: user }),
        ...opts.home,
      },
      { owner: user, mode: opts.homeMode ?? 0o750 },
    ),
  };
  for (const other of otherUsers) homes[other] = dir({}, { owner: other, mode: 0o750 });

  return {
    hostname,
    user,
    home: `/home/${user}`,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", SHELL: "/bin/bash" },
    root: dir({
      etc: dir({ hostname: file(`${hostname}\n`), passwd: file(passwd), ...opts.etc }),
      home: dir(homes),
      root: dir({}, { mode: 0o700 }),
      tmp: dir({}, { mode: 0o777 }),
      var: dir({ log: dir({ syslog: file(`Oct  6 06:00:01 ${hostname} systemd[1]: Started daily cleanup.\n`), ...opts.log }) }),
      ...opts.extra,
    }),
  };
}

/** A syslog-style timestamp on 6 Oct, `minute` minutes after 06:00, at `second`. */
export function stamp(minute: number, second: number): string {
  const h = 6 + Math.floor(minute / 60);
  const m = minute % 60;
  return `Oct  6 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

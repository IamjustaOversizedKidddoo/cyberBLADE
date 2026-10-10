import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { Proc } from "@/lib/lab-engine/terminal/processes";
import type { Service } from "@/lib/lab-engine/terminal/services";
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
  bin?: Record<string, Node>;
  extra?: Record<string, Node>;
  processes?: Proc[];
  services?: Service[];
  sudoers?: string;
};

const elf = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o755 });
const suidElf = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o4755, owner: "root", group: "root" });
const sgidShadow = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o2755, owner: "root", group: "shadow" });
const sgidCrontab = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o2755, owner: "root", group: "crontab" });

/** Standard Ubuntu binary set in /usr/bin. */
export function standardBinaries(): Record<string, Node> {
  return {
    cat: elf(),
    chage: sgidShadow(),
    chfn: suidElf(),
    chmod: elf(),
    chown: elf(),
    chgrp: elf(),
    chsh: suidElf(),
    cp: elf(),
    crontab: sgidCrontab(),
    curl: elf(),
    date: elf(),
    dig: elf(),
    echo: elf(),
    env: elf(),
    expiry: sgidShadow(),
    find: elf(),
    gpasswd: suidElf(),
    grep: elf(),
    head: elf(),
    hostname: elf(),
    id: elf(),
    ip: elf(),
    kill: elf(),
    ls: elf(),
    mkdir: elf(),
    mount: suidElf(),
    mv: elf(),
    newgrp: suidElf(),
    passwd: suidElf(),
    pgrep: elf(),
    ping: elf(),
    ps: elf(),
    pwd: elf(),
    rm: elf(),
    ss: elf(),
    su: suidElf(),
    sudo: suidElf(),
    systemctl: elf(),
    tail: elf(),
    touch: elf(),
    tr: elf(),
    traceroute: elf(),
    umount: suidElf(),
    uname: elf(),
    wc: elf(),
    whoami: elf(),
  };
}

/** A realistic small Linux machine: /etc, /home/<user>, /var/log, /tmp. Callers add the lab's files. */
export function baseWorld(opts: BaseOptions): World {
  const { user, hostname, otherUsers = [] } = opts;
  const all = [user, ...otherUsers];
  const passwd =
    "root:x:0:0:root:/root:/bin/bash\n" +
    "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n" +
    all.map((u, i) => `${u}:x:${1000 + i}:${1000 + i}:${u}:/home/${u}:/bin/bash\n`).join("");
  // One private group per user (Ubuntu's default), plus the usual system groups.
  const group =
    "root:x:0:\ndaemon:x:1:\nadm:x:4:\ncrontab:x:106:\nsudo:x:27:\nshadow:x:42:\n" +
    all.map((u, i) => `${u}:x:${1000 + i}:\n`).join("");

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

  const etcFiles: Record<string, Node> = {
    hostname: file(`${hostname}\n`),
    passwd: file(passwd),
    group: file(group),
    ...opts.etc,
  };
  if (opts.sudoers) {
    etcFiles.sudoers = file(opts.sudoers, { mode: 0o440, owner: "root", group: "root" });
  }

  return {
    hostname,
    user,
    home: `/home/${user}`,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", SHELL: "/bin/bash" },
    processes: opts.processes,
    services: opts.services,
    root: dir({
      dev: dir({ null: file("", { mode: 0o666 }) }),
      etc: dir(etcFiles),
      home: dir(homes),
      root: dir({}, { mode: 0o700 }),
      tmp: dir({}, { mode: 0o777 }),
      usr: dir({
        bin: dir({
          ...standardBinaries(),
          ...opts.bin,
        }),
      }),
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

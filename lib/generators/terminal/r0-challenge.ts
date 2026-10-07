import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { Generator } from "../index";
import { formatFlag } from "../flag";
import type { Rng } from "../rng";
import { baseWorld, pickHostname, pickIp, pickUsers, stamp } from "./base-world";

function authLog(rng: Rng, hostname: string, counts: Map<string, number>, learner: string): string {
  const events: string[] = [];
  for (const [name, n] of counts) {
    const ip = pickIp(rng, "203.0");
    for (let i = 0; i < n; i++) {
      events.push(`sshd[${rng.int(1000, 9999)}]: Failed password for ${name} from ${ip} port ${rng.int(30000, 60000)} ssh2`);
    }
  }
  // sshd says "invalid user" only for names that don't exist on the machine. A few guesses at
  // common default names, always fewer than the real target, keep the log realistic.
  for (const ghost of rng.shuffle(["admin", "oracle", "test", "ubuntu"]).slice(0, 2)) {
    const ip = pickIp(rng, "198.51");
    for (let i = 0; i < rng.int(1, 4); i++) {
      events.push(`sshd[${rng.int(1000, 9999)}]: Failed password for invalid user ${ghost} from ${ip} port ${rng.int(30000, 60000)} ssh2`);
    }
  }
  for (let i = 0; i < rng.int(6, 12); i++) {
    events.push(`sshd[${rng.int(1000, 9999)}]: Accepted publickey for ${learner} from ${pickIp(rng, "10.20")} port ${rng.int(30000, 60000)} ssh2`);
  }
  for (let i = 0; i < rng.int(3, 6); i++) events.push(`CRON[${rng.int(1000, 9999)}]: pam_unix(cron:session): session opened for user root`);
  return rng
    .shuffle(events)
    .map((e, i) => `${stamp(i * 2, rng.int(0, 59))} ${hostname} ${e}\n`)
    .join("");
}

/**
 * Rank 0 challenge ("Night shift"): find who is being brute-forced in auth.log, recover a file from
 * a directory you can enter but not list (its name is in the handover note), and count the
 * allow-listed IPs.
 */
export const r0Challenge: Generator = (rng) => {
  const [user, ...targets] = pickUsers(rng, 5);
  const hostname = pickHostname(rng);

  // One account clearly attacked the most; the others less.
  const top = targets[0];
  const counts = new Map<string, number>([[top, rng.int(14, 22)]]);
  for (const t of targets.slice(1)) counts.set(t, rng.int(2, 9));

  const dropName = `${rng.pick(["handover", "keys", "vpn", "access"])}-${rng.hex(4)}.txt`;
  const flag = formatFlag(rng.hex(12));

  const ipCount = rng.int(6, 14);
  const allow =
    "# Firewall allow-list — one IP per line. Lines starting with # are comments.\n" +
    Array.from({ length: ipCount }, (_, i) => (i % 4 === 3 ? `# office printer below\n${pickIp(rng, "10.30")}\n` : `${pickIp(rng, "10.30")}\n`)).join("");

  const world = baseWorld({
    user,
    hostname,
    otherUsers: targets,
    home: {
      "notes.txt": file(
        `Handover from the day shift:\n- Watch /var/log/auth.log, someone is hammering SSH.\n- I left the file you need in /srv/drop/${dropName} (you can't list that folder, ask for the exact name — it's this one).\n- The firewall allow-list is /etc/firewall/allowlist.txt. Tell me how many IPs are on it.\n`,
        { owner: user },
      ),
    },
    etc: { firewall: dir({ "allowlist.txt": file(allow) }) },
    log: { "auth.log": file(authLog(rng, hostname, counts, user), { group: "adm" }) },
    extra: {
      srv: dir({
        drop: dir({ [dropName]: file(`Recovered. Flag: ${flag}\n`), "decoy.txt": file("nothing here\n") }, { mode: 0o711 }),
      }),
    },
  });
  return { world, answers: { attacked: top, flag, ips: String(ipCount) } };
};

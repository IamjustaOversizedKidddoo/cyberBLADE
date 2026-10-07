import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { Generator } from "../index";
import { formatFlag } from "../flag";
import type { Rng } from "../rng";
import { baseWorld, pickHostname, pickUsers, stamp } from "./base-world";

const HIDDEN = [".stash", ".cache_note", ".todo_secret", ".handover"];
const SERVICES = ["api", "worker", "scheduler", "billing"];
const INFO = ["request served in 42ms", "cache warmed", "health check ok", "job queued", "user session refreshed"];
const WARN = ["slow response from db", "retrying upstream call", "disk usage at 81%"];
const ERRORS = ["timeout talking to db", "payment gateway refused connection", "worker crashed, restarting", "invalid token rejected"];

function appLog(rng: Rng, lines: number, errorCount: number): string {
  const errorAt = new Set(rng.shuffle(Array.from({ length: lines }, (_, i) => i)).slice(0, errorCount));
  return Array.from({ length: lines }, (_, i) => {
    const level = errorAt.has(i) ? "ERROR" : rng.next() < 0.15 ? "WARN" : "INFO";
    const msg = level === "ERROR" ? rng.pick(ERRORS) : level === "WARN" ? rng.pick(WARN) : rng.pick(INFO);
    return `${stamp(Math.floor(i / 4), (i * 13) % 60)} ${rng.pick(SERVICES)}[${rng.int(200, 999)}] ${level} ${msg}\n`;
  }).join("");
}

/**
 * Lesson 4 lab: a hidden file in home (ls -a, cat), a flag on the last line of a 300-line
 * backup log (tail), and a count of ERROR lines in the app log (grep -c).
 */
export const firstTerminal: Generator = (rng) => {
  const [user] = pickUsers(rng, 1);
  const hostname = pickHostname(rng);
  const hiddenName = rng.pick(HIDDEN);
  const flag1 = formatFlag(rng.hex(12));
  const flag2 = formatFlag(rng.hex(12));
  const errorCount = rng.int(7, 23);

  const backup =
    Array.from({ length: 299 }, (_, i) => `${stamp(i % 600, i % 60)} backup: copied chunk ${i + 1}/300\n`).join("") +
    `${stamp(599, 59)} backup: finished. verification code ${flag2}\n`;

  const world = baseWorld({
    user,
    hostname,
    home: {
      [hiddenName]: file(`Note to self: the first flag is ${flag1}\n`, { owner: user, mode: 0o600 }),
      "README.txt": file("Welcome! Explore this machine. Some files are hidden.\n", { owner: user }),
      projects: dir({ "ideas.txt": file("learn grep\nlearn tail\n", { owner: user }) }, { owner: user }),
    },
    log: {
      "app.log": file(appLog(rng, rng.int(120, 180), errorCount)),
      "backup.log": file(backup),
    },
  });
  return { env: { kind: "terminal", world }, answers: { flag1, flag2, errors: String(errorCount) } };
};

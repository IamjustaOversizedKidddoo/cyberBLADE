import { file } from "@/lib/lab-engine/terminal/build";
import type { FileNode } from "@/lib/lab-engine/terminal/types";
import type { Generator } from "../index";
import { formatFlag } from "../flag";
import { baseWorld, pickHostname, pickUsers } from "./base-world";

const NAMES = ["budget.csv", "roster.txt", "minutes.txt", "plan.md", "vendors.csv", "schedule.txt", "inventory.txt", "contacts.txt"];

/**
 * Lesson 2 lab: ~/shared holds files with different owners and permissions.
 * Exactly one file is unreadable for the learner (rw------- owned by a colleague) and exactly one
 * is rw-r--r-- (owner writes, everyone reads) — that one contains the flag.
 */
export const filesPerms: Generator = (rng) => {
  const [user, colleague] = pickUsers(rng, 2);
  const hostname = pickHostname(rng);
  const [secretName, flagName, ...rest] = rng.shuffle(NAMES).slice(0, rng.int(5, 6));
  const flag = formatFlag(rng.hex(12));

  // Modes for the learner's own files: readable by the learner, never rw-r--r-- and never unreadable.
  const ownModes = [0o664, 0o660, 0o666, 0o640];
  const shared: Record<string, FileNode> = {
    [secretName]: file(`Salary review — confidential.\n`, { owner: colleague, mode: 0o600 }),
    [flagName]: file(`Team update from ${colleague}.\nEveryone can read this, only ${colleague} can change it.\n${flag}\n`, {
      owner: colleague,
      mode: 0o644,
    }),
  };
  rest.forEach((name, i) => {
    shared[name] = file(`Working notes ${i + 1}.\n`, { owner: user, mode: ownModes[i % ownModes.length] });
  });

  const world = baseWorld({
    user,
    hostname,
    otherUsers: [colleague],
    home: { shared: { kind: "dir", children: shared, owner: user, group: user, mode: 0o755, mtime: "2026-10-06T09:14:00.000Z" } },
  });
  return { world, answers: { unreadable: secretName, flag } };
};

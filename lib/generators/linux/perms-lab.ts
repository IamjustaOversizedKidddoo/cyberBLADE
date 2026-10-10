import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { FileNode } from "@/lib/lab-engine/terminal/types";
import { formatFlag } from "../flag";
import type { Generator } from "../index";
import { baseWorld, pickHostname, pickUsers } from "../terminal/base-world";

const CONFIG_MODES = [
  { octal: "640", mode: 0o640 },
  { octal: "644", mode: 0o644 },
  { octal: "600", mode: 0o600 },
  { octal: "660", mode: 0o660 },
  { octal: "664", mode: 0o664 },
  { octal: "440", mode: 0o440 },
];

const PAYROLL_GROUPS = ["finance", "payroll", "hr", "accounting"];

const SHARED_FILES = [
  "notes.txt",
  "project.log",
  "archive.tar",
  "readme.md",
  "template.dot",
  "index.html",
  "cache.tmp",
  "upload.tmp",
];

export const permsLab: Generator = (rng) => {
  const [user, colleague] = pickUsers(rng, 2);
  const hostname = pickHostname(rng);

  // o1: octal mode of /srv/app/config.ini
  const chosenConfig = rng.pick(CONFIG_MODES);

  // o2: flag in ~/vault/note.txt (owned by user, mode 000)
  const flag = formatFlag(rng.hex(12));

  // o3: group for /srv/payroll/salaries.csv
  const payrollGroup = rng.pick(PAYROLL_GROUPS);

  // o4: world-writable file in /srv/shared
  const shuffledFiles = rng.shuffle(SHARED_FILES);
  const fileCount = rng.int(5, 8);
  const selectedFiles = shuffledFiles.slice(0, fileCount);
  const writableName = selectedFiles[0];

  const sharedChildren: Record<string, FileNode> = {};
  for (const name of selectedFiles) {
    if (name === writableName) {
      sharedChildren[name] = file("Shared data content\n", {
        owner: colleague,
        group: colleague,
        mode: 0o666, // world-writable!
      });
    } else {
      sharedChildren[name] = file("Read-only reference data\n", {
        owner: colleague,
        group: colleague,
        mode: 0o644,
      });
    }
  }

  const world = baseWorld({
    user,
    hostname,
    otherUsers: [colleague],
    home: {
      vault: dir(
        {
          "note.txt": file(`CONFIDENTIAL BRIEFING NOTE\n${flag}\n`, {
            owner: user,
            group: user,
            mode: 0o000,
          }),
        },
        { owner: user, mode: 0o700 },
      ),
    },
    etc: {
      group: file(
        `root:x:0:\nadm:x:4:\ncrontab:x:106:\nsudo:x:27:\nshadow:x:42:\n${payrollGroup}:x:200:${colleague}\n${user}:x:1000:\n${colleague}:x:1001:\n`,
      ),
    },
    extra: {
      srv: dir({
        app: dir({
          "config.ini": file("[app]\nenv = production\nport = 8080\n", {
            owner: "root",
            group: "root",
            mode: chosenConfig.mode,
          }),
        }),
        payroll: dir({
          "salaries.csv": file("employee,dept,salary\njane,eng,120000\n", {
            owner: "root",
            group: payrollGroup,
            mode: 0o640,
          }),
        }),
        shared: dir(sharedChildren, { mode: 0o755 }),
      }),
    },
  });

  return {
    env: { kind: "terminal", world },
    answers: {
      mode: chosenConfig.octal,
      flag,
      group: payrollGroup,
      writable: writableName,
    },
  };
};

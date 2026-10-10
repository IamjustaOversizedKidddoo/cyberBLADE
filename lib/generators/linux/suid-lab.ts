import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { Node } from "@/lib/lab-engine/terminal/types";
import type { Generator } from "../index";
import { baseWorld, pickHostname, pickUsers } from "../terminal/base-world";

const NON_STANDARD_SUIDS = [
  { path: "/usr/local/bin/backup-sync", name: "backup-sync", parentDir: "local" },
  { path: "/usr/local/bin/net-probe", name: "net-probe", parentDir: "local" },
  { path: "/opt/metrics/bin/collector", name: "collector", parentDir: "opt" },
  { path: "/usr/local/bin/sys-report", name: "sys-report", parentDir: "local" },
  { path: "/opt/agent/bin/healthcheck", name: "healthcheck", parentDir: "opt" },
];

const SUDO_COMMANDS = [
  "/usr/bin/find",
  "/usr/bin/cat",
  "/usr/bin/head",
  "/usr/bin/grep",
  "/usr/bin/tail",
];

const suidElf = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o4755, owner: "root", group: "root" });

export const suidLab: Generator = (rng) => {
  const [user, colleague] = pickUsers(rng, 2);
  const hostname = pickHostname(rng);

  const pickedSuid = rng.pick(NON_STANDARD_SUIDS);
  const pickedSudoCmd = rng.pick(SUDO_COMMANDS);

  // Standard SUID files in /usr/bin is 9.
  // With 1 non-standard SUID, total is 10.
  const totalCount = "10";

  const sudoersText =
    'Defaults env_reset, mail_badpass, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin", use_pty\n\n' +
    "root ALL=(ALL:ALL) ALL\n" +
    "%sudo ALL=(ALL:ALL) ALL\n" +
    `${user} ALL=(root) NOPASSWD: ${pickedSudoCmd}\n`;

  const usrLocalBin: Record<string, Node> = {};
  const extraDirs: Record<string, Node> = {};
  if (pickedSuid.path.startsWith("/usr/local/bin/")) {
    usrLocalBin[pickedSuid.name] = suidElf();
  } else if (pickedSuid.path.startsWith("/opt/metrics/bin/")) {
    extraDirs.opt = dir({
      metrics: dir({
        bin: dir({
          [pickedSuid.name]: suidElf(),
        }),
      }),
    });
  } else if (pickedSuid.path.startsWith("/opt/agent/bin/")) {
    extraDirs.opt = dir({
      agent: dir({
        bin: dir({
          [pickedSuid.name]: suidElf(),
        }),
      }),
    });
  }

  const world = baseWorld({
    user,
    hostname,
    otherUsers: [colleague],
    sudoers: sudoersText,
    usrLocalBin,
    extra: extraDirs,
  });

  return {
    env: { kind: "terminal", world },
    answers: {
      suid: pickedSuid.path,
      count: totalCount,
      owner: "root",
      sudoCmd: pickedSudoCmd,
    },
  };
};

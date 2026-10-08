import type { Proc } from "@/lib/lab-engine/terminal/processes";
import type { World } from "@/lib/lab-engine/terminal/types";
import { permWorld } from "./fixture-perms";

const p = (pid: number, ppid: number, user: string, argv: string[], extra: Partial<Proc> = {}): Proc => ({
  pid,
  ppid,
  user,
  argv,
  state: "S",
  stat: "Ss",
  tty: "?",
  start: "08:55",
  cpuTime: "0:00",
  cpu: 0,
  mem: 0.1,
  vsz: 10000,
  rss: 5000,
  ...extra,
});

/** A small server: init, kernel threads, journald, resolved, cron, sshd + session, op's shell and jobs. */
export const FIXTURE_PROCS: Proc[] = [
  p(1, 0, "root", ["/sbin/init", "splash"], { cpuTime: "0:02", mem: 0.3, vsz: 167832, rss: 13136 }),
  p(2, 0, "root", ["[kthreadd]"], { stat: "S", vsz: 0, rss: 0, mem: 0 }),
  p(31, 2, "root", ["[kworker/0:1-events]"], { state: "I", stat: "I", vsz: 0, rss: 0, mem: 0 }),
  p(312, 1, "root", ["/usr/lib/systemd/systemd-journald"], { stat: "Ss", vsz: 50460, rss: 15872, mem: 0.4 }),
  p(455, 1, "systemd-resolve", ["/usr/lib/systemd/systemd-resolved"], { vsz: 21592, rss: 12928, mem: 0.3 }),
  p(640, 1, "root", ["/usr/sbin/cron", "-f", "-P"], { vsz: 6824, rss: 2688 }),
  p(812, 1, "root", ["sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"], { vsz: 12016, rss: 7936, mem: 0.2 }),
  p(2190, 812, "root", ["sshd: op [priv]"], { vsz: 14720, rss: 9216, mem: 0.2 }),
  p(2200, 2190, "op", ["sshd: op@pts/0"], { stat: "S", vsz: 14980, rss: 6400, mem: 0.1 }),
  p(1500, 1, "root", ["python3", "-m", "http.server", "8000"], { stat: "S", vsz: 31236, rss: 19456, mem: 0.4, env: { HOME: "/root", SECRET: "x" } }),
  p(2150, 2200, "op", ["sleep", "600"], { stat: "S", tty: "pts/0", vsz: 5680, rss: 1920, mem: 0, env: { HOME: "/home/op", LANG: "C.UTF-8" } }),
];

export function procWorld(user = "op"): World {
  return { ...permWorld(user), processes: FIXTURE_PROCS, shellPid: 2201, shellParent: 2200 };
}

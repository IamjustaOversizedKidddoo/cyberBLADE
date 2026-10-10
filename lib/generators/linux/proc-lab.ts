import { file } from "@/lib/lab-engine/terminal/build";
import type { Proc } from "@/lib/lab-engine/terminal/processes";
import type { Generator } from "../index";
import { baseWorld, pickHostname, pickUsers } from "../terminal/base-world";

const SUSPICIOUS_PATHS = [
  "/tmp/[kworker/2:1]",
  "/dev/shm/systemd-sync",
  "/tmp/cron-service",
  "/dev/shm/[kworker/0:2]",
  "/tmp/syslog-agent",
];

const PARENT_PROCS = [
  { pid: 901, name: "nginx", user: "www-data", argv: ["nginx: worker process"] },
  { pid: 640, name: "cron", user: "root", argv: ["/usr/sbin/cron", "-f", "-P"] },
  { pid: 812, name: "sshd", user: "root", argv: ["sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"] },
];

export const procLab: Generator = (rng) => {
  const [user, otherUser] = pickUsers(rng, 2);
  const hostname = pickHostname(rng);

  const suspiciousPath = rng.pick(SUSPICIOUS_PATHS);
  const parent = rng.pick(PARENT_PROCS);
  const suspPid = rng.int(3150, 4800);
  const suspUser = parent.user === "root" ? "www-data" : parent.user;
  const remoteIp = `198.51.100.${rng.int(1, 254)}`;
  const remotePort = rng.int(4444, 9999);
  const remote = `${remoteIp}:${remotePort}`;

  // Suspicious process
  const suspProc: Proc = {
    pid: suspPid,
    ppid: parent.pid,
    user: suspUser,
    argv: [suspiciousPath, "-c", remote],
    state: "S",
    stat: "S",
    tty: "?",
    start: "09:30",
    cpuTime: "0:01",
    cpu: 0,
    mem: 0.2,
    vsz: 18400,
    rss: 7600,
  };

  // Normal system processes
  const procs: Proc[] = [
    { pid: 1, ppid: 0, user: "root", argv: ["/sbin/init", "splash"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:02", cpu: 0, mem: 0.3, vsz: 167832, rss: 13136 },
    { pid: 2, ppid: 0, user: "root", argv: ["[kthreadd]"], state: "S", stat: "S", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0, vsz: 0, rss: 0 },
    { pid: 31, ppid: 2, user: "root", argv: ["[kworker/0:1-events]"], state: "I", stat: "I", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0, vsz: 0, rss: 0 },
    { pid: 312, ppid: 1, user: "root", argv: ["/usr/lib/systemd/systemd-journald"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.4, vsz: 50460, rss: 15872 },
    { pid: 455, ppid: 1, user: "systemd-resolve", argv: ["/usr/lib/systemd/systemd-resolved"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.3, vsz: 21592, rss: 12928 },
    { pid: 640, ppid: 1, user: "root", argv: ["/usr/sbin/cron", "-f", "-P"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 6824, rss: 2688 },
    { pid: 700, ppid: 1, user: "syslog", argv: ["/usr/sbin/rsyslogd", "-n", "-iNONE"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 7800, rss: 3200 },
    { pid: 812, ppid: 1, user: "root", argv: ["sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.2, vsz: 12016, rss: 7936 },
    { pid: 900, ppid: 1, user: "root", argv: ["nginx: master process /usr/sbin/nginx -g daemon on; master_process on;"], state: "S", stat: "Ss", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.2, vsz: 13500, rss: 6200 },
    { pid: 901, ppid: 900, user: "www-data", argv: ["nginx: worker process"], state: "S", stat: "S", tty: "?", start: "08:55", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 14100, rss: 5800 },
    { pid: 2190, ppid: 812, user: "root", argv: [`sshd: ${user} [priv]`], state: "S", stat: "Ss", tty: "?", start: "08:58", cpuTime: "0:00", cpu: 0, mem: 0.2, vsz: 14720, rss: 9216 },
    { pid: 2200, ppid: 2190, user, argv: [`sshd: ${user}@pts/0`], state: "S", stat: "S", tty: "?", start: "08:58", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 14980, rss: 6400 },
    // 2 decoy benign learner scripts in /tmp
    { pid: 2250, ppid: 2200, user, argv: ["/bin/bash", "/tmp/build.sh"], state: "S", stat: "S", tty: "pts/0", start: "09:00", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 8500, rss: 4200 },
    { pid: 2260, ppid: 2200, user, argv: ["/bin/bash", "/tmp/cleanup.sh"], state: "S", stat: "S", tty: "pts/0", start: "09:05", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 8500, rss: 4200 },
    suspProc,
  ];

  // Additional background background workers
  for (let i = 1; i <= 10; i++) {
    procs.push({
      pid: 1000 + i * 50,
      ppid: 1,
      user: "daemon",
      argv: [`/usr/bin/worker-agent-${i}`],
      state: "S",
      stat: "S",
      tty: "?",
      start: "08:55",
      cpuTime: "0:00",
      cpu: 0,
      mem: 0.1,
      vsz: 9000,
      rss: 3000,
    });
  }

  const world = baseWorld({
    user,
    hostname,
    otherUsers: [otherUser],
    processes: procs,
    extra: {
      tmp: {
        kind: "dir",
        owner: "root",
        group: "root",
        mode: 0o1777,
        mtime: "2026-10-07T08:55:00.000Z",
        children: {
          "build.sh": file("#!/bin/bash\necho building\n", { owner: user, mode: 0o755 }),
          "cleanup.sh": file("#!/bin/bash\necho cleaning\n", { owner: user, mode: 0o755 }),
        },
      },
    },
  });

  return {
    env: { kind: "terminal", world },
    answers: {
      pid: String(suspPid),
      user: suspUser,
      parent: parent.name,
      remote,
    },
  };
};

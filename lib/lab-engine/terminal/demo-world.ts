import { dir, file } from "./build";
import type { Network } from "./network";
import type { Proc } from "./processes";
import type { Service } from "./services";
import type { World } from "./types";

/** The demo machine's office network. Public addresses are RFC 5737 documentation ranges only. */
function demoNetwork(): Network {
  const nginx: [string, string][] = [["Server", "nginx/1.24.0"], ["Content-Type", "text/html"]];
  return {
    interfaces: [{ name: "eth0", mac: "52:54:00:12:34:56", ipv4: "10.0.2.15/24", state: "UP", dynamic: true }],
    gateway: "10.0.2.2",
    resolver: "127.0.0.53",
    neighbors: [{ ip: "10.0.2.2", mac: "52:55:0a:00:02:02" }],
    dns: {
      "example.com": { A: ["203.0.113.10"], MX: [{ pref: 10, host: "mail.example.com" }], NS: ["ns1.example.com"], TXT: ["v=spf1 -all"] },
      "www.example.com": { CNAME: "example.com" },
      "mail.example.com": { A: ["203.0.113.25"] },
      "intranet.corp.example": { A: ["10.0.2.50"] },
      "offline.example.net": { A: ["198.51.100.99"] },
    },
    hosts: {
      "203.0.113.10": {
        name: "example.com",
        reachable: true,
        rttMs: 18.4,
        ttl: 54,
        hops: ["10.0.2.2", "192.0.2.1", null, "198.51.100.1", "203.0.113.10"],
        openPorts: [80, 443],
        http: {
          "/": { status: 301, reason: "Moved Permanently", headers: [["Server", "nginx/1.24.0"], ["Location", "https://example.com/"]], body: "" },
        },
        https: {
          "/": {
            status: 200,
            reason: "OK",
            headers: [...nginx, ["Strict-Transport-Security", "max-age=31536000"]],
            body: "<h1>Example Domain</h1>\n",
          },
        },
      },
      "203.0.113.25": { name: "mail.example.com", reachable: true, rttMs: 21.7, ttl: 54, hops: ["10.0.2.2", "192.0.2.1", "203.0.113.25"], openPorts: [25] },
      "10.0.2.50": {
        name: "intranet.corp.example",
        reachable: true,
        rttMs: 0.6,
        ttl: 64,
        hops: ["10.0.2.50"],
        openPorts: [80],
        http: {
          "/": { status: 200, reason: "OK", headers: nginx, body: "<h1>Staff intranet</h1>\n" },
        },
      },
      "198.51.100.99": { reachable: false, rttMs: 0, ttl: 0, hops: ["10.0.2.2", "192.0.2.1"] },
    },
    listening: [
      { proto: "tcp", addr: "0.0.0.0", port: 22, process: "sshd", pid: 812, backlog: 128 },
      { proto: "tcp", addr: "127.0.0.53%lo", port: 53, process: "systemd-resolve", pid: 455, backlog: 4096 },
      { proto: "udp", addr: "127.0.0.53%lo", port: 53, process: "systemd-resolve", pid: 455 },
    ],
  };
}

const elf = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o755 });
const suidElf = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o4755, owner: "root", group: "root" });
const sgidShadow = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o2755, owner: "root", group: "shadow" });
const sgidCrontab = () => file("\x7fELF (simulated binary — not runnable in this lab)\n", { mode: 0o2755, owner: "root", group: "crontab" });

const DEMO_PROCS: Proc[] = [
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
  { pid: 2190, ppid: 812, user: "root", argv: ["sshd: learner [priv]"], state: "S", stat: "Ss", tty: "?", start: "08:58", cpuTime: "0:00", cpu: 0, mem: 0.2, vsz: 14720, rss: 9216 },
  { pid: 2200, ppid: 2190, user: "learner", argv: ["sshd: learner@pts/0"], state: "S", stat: "S", tty: "?", start: "08:58", cpuTime: "0:00", cpu: 0, mem: 0.1, vsz: 14980, rss: 6400 },
];

const DEMO_SERVICES: Service[] = [
  {
    name: "ssh",
    description: "OpenBSD Secure Shell server",
    unitPath: "/usr/lib/systemd/system/ssh.service",
    enabled: "enabled",
    active: "active",
    sub: "running",
    since: "Wed 2026-10-07 08:55:04 IST",
    mainPid: 812,
  },
  {
    name: "cron",
    description: "Regular background program processing daemon",
    unitPath: "/usr/lib/systemd/system/cron.service",
    enabled: "enabled",
    active: "active",
    sub: "running",
    since: "Wed 2026-10-07 08:55:04 IST",
    mainPid: 640,
  },
  {
    name: "nginx",
    description: "A high performance web server and a reverse proxy server",
    unitPath: "/usr/lib/systemd/system/nginx.service",
    enabled: "enabled",
    active: "active",
    sub: "running",
    since: "Wed 2026-10-07 08:55:04 IST",
    mainPid: 900,
  },
  {
    name: "systemd-resolved",
    description: "Network Name Resolution",
    unitPath: "/usr/lib/systemd/system/systemd-resolved.service",
    enabled: "enabled",
    active: "active",
    sub: "running",
    since: "Wed 2026-10-07 08:55:04 IST",
    mainPid: 455,
  },
  {
    name: "backup",
    description: "Nightly Backup Job",
    unitPath: "/usr/lib/systemd/system/backup.service",
    enabled: "enabled",
    active: "failed",
    sub: "failed",
    since: "Wed 2026-10-07 09:00:00 IST",
    result: "exit-code",
  },
  {
    name: "apache2",
    description: "The Apache HTTP Server",
    unitPath: "/usr/lib/systemd/system/apache2.service",
    enabled: "disabled",
    active: "inactive",
    sub: "dead",
  },
];

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
    network: demoNetwork(),
    processes: DEMO_PROCS,
    services: DEMO_SERVICES,
    shellPid: 2201,
    shellParent: 2200,
    root: dir({
      dev: dir({ null: file("", { mode: 0o666 }) }),
      etc: dir({
        hostname: file("neon-demo\n"),
        "os-release": file('NAME="Ubuntu"\nVERSION="24.04 LTS (Noble Numbat)"\nID=ubuntu\n'),
        passwd: file(
          "root:x:0:0:root:/root:/bin/bash\n" +
            "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n" +
            "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n" +
            "learner:x:1000:1000:Learner:/home/learner:/bin/bash\n",
        ),
        group: file("root:x:0:\nadm:x:4:\ncrontab:x:106:\nsudo:x:27:learner\nshadow:x:42:\nwww-data:x:33:\nlearner:x:1000:\n"),
        shadow: file("root:*:19700:0:99999:7:::\nlearner:$y$j9T$demo$hash:19700:0:99999:7:::\n", { mode: 0o640, group: "shadow" }),
        sudoers: file(
          'Defaults env_reset, mail_badpass, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin", use_pty\n\n' +
            "root ALL=(ALL:ALL) ALL\n" +
            "%sudo ALL=(ALL:ALL) ALL\n" +
            "learner ALL=(root) NOPASSWD: /usr/bin/systemctl status *\n",
          { mode: 0o440, owner: "root", group: "root" },
        ),
        crontab: file(
          "SHELL=/bin/sh\n" +
            "PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n" +
            "17 *	* * *	root    cd / && run-parts --report /etc/cron.hourly\n" +
            "25 6	* * *	root	test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }\n" +
            "47 6	* * 7	root	test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }\n" +
            "52 6	1 * *	root	test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }\n",
        ),
        ssh: dir({
          sshd_config: file("Port 22\nPermitRootLogin prohibit-password\nPasswordAuthentication yes\n", { mode: 0o644 }),
        }),
        hosts: file("127.0.0.1 localhost\n127.0.1.1 neon-demo\n"),
        "resolv.conf": file("nameserver 127.0.0.53\noptions edns0 trust-ad\n"),
      }),
      home: dir({
        learner: dir(
          {
            ".bashrc": file("# ~/.bashrc\nalias ll='ls -la'\n", me),
            ".ssh": dir(
              {
                authorized_keys: file("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExamplePublicKeyForLearnerAccess learner@laptop\n", {
                  mode: 0o600,
                  owner: "learner",
                }),
              },
              { ...me, mode: 0o700 },
            ),
            "notes.txt": file("Remember: only test systems you own.\nRead the logs every morning.\n", me),
            Documents: dir({ "report.txt": file("Quarterly report draft\n", me) }, me),
            Downloads: dir({}, me),
          },
          { ...me, mode: 0o750 },
        ),
      }),
      root: dir({ ".bash_history": file("apt update\n", { mode: 0o600 }) }, { mode: 0o700 }),
      tmp: dir({}, { mode: 0o1777 }),
      usr: dir({
        bin: dir({
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
        }),
        lib: dir({
          systemd: dir({
            system: dir({
              "ssh.service": file("[Unit]\nDescription=OpenBSD Secure Shell server\n"),
              "cron.service": file("[Unit]\nDescription=Regular background program processing daemon\n"),
              "nginx.service": file("[Unit]\nDescription=A high performance web server\n"),
              "systemd-resolved.service": file("[Unit]\nDescription=Network Name Resolution\n"),
              "backup.service": file("[Unit]\nDescription=Nightly Backup Job\n"),
              "apache2.service": file("[Unit]\nDescription=The Apache HTTP Server\n"),
            }),
          }),
        }),
      }),
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

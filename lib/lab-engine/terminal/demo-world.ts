import { dir, file } from "./build";
import type { Network } from "./network";
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
        group: file("root:x:0:\nadm:x:4:\nsudo:x:27:learner\nshadow:x:42:\nwww-data:x:33:\nlearner:x:1000:\n"),
        shadow: file("root:*:19700:0:99999:7:::\nlearner:$y$j9T$demo$hash:19700:0:99999:7:::\n", { mode: 0o640, group: "shadow" }),
        hosts: file("127.0.0.1 localhost\n127.0.1.1 neon-demo\n"),
        "resolv.conf": file("nameserver 127.0.0.53\noptions edns0 trust-ad\n"),
      }),
      home: dir({
        learner: dir(
          {
            ".bashrc": file("# ~/.bashrc\nalias ll='ls -la'\n", me),
            "notes.txt": file("Remember: only test systems you own.\nRead the logs every morning.\n", me),
            Documents: dir({ "report.txt": file("Quarterly report draft\n", me) }, me),
            Downloads: dir({}, me),
          },
          { ...me, mode: 0o750 },
        ),
      }),
      root: dir({ ".bash_history": file("apt update\n", { mode: 0o600 }) }, { mode: 0o700 }),
      tmp: dir({}, { mode: 0o1777 }),
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

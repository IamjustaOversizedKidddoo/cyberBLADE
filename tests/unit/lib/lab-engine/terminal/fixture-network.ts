import type { Network } from "@/lib/lab-engine/terminal/network";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "./fixture-world";

/** A small office network. Public addresses are RFC 5737 documentation ranges only. */
export function fixtureNetwork(): Network {
  return {
    interfaces: [
      { name: "eth0", mac: "52:54:00:12:34:56", ipv4: "10.0.2.15/24", ipv6: "fe80::5054:ff:fe12:3456/64", state: "UP", dynamic: true },
      { name: "eth1", mac: "52:54:00:ab:cd:ef", state: "DOWN" },
    ],
    gateway: "10.0.2.2",
    resolver: "127.0.0.53",
    neighbors: [{ ip: "10.0.2.2", mac: "52:55:0a:00:02:02" }],
    dns: {
      "example.com": { A: ["203.0.113.10"], MX: [{ pref: 10, host: "mail.example.com" }], NS: ["ns1.example.com"] },
      "www.example.com": { CNAME: "example.com" },
      "intranet.corp.example": { A: ["10.0.2.50"] },
      "dead.example.net": { A: ["198.51.100.99"] },
    },
    hosts: {
      "203.0.113.10": {
        name: "example.com",
        reachable: true,
        rttMs: 12.3,
        ttl: 56,
        hops: ["10.0.2.2", null, "198.51.100.1", "203.0.113.10"],
        openPorts: [80, 443],
        http: {
          "/": { status: 200, reason: "OK", headers: [["Server", "nginx/1.24.0"], ["Content-Type", "text/html"]], body: "<h1>Example</h1>\n" },
        },
      },
      "10.0.2.50": {
        name: "intranet.corp.example",
        reachable: true,
        rttMs: 0.8,
        ttl: 64,
        hops: ["10.0.2.50"],
        openPorts: [80],
        http: {
          "/": { status: 301, reason: "Moved Permanently", headers: [["Server", "Apache/2.4.58"], ["Location", "/home"]], body: "" },
          "/home": { status: 200, reason: "OK", headers: [["Server", "Apache/2.4.58"], ["Content-Type", "text/plain"]], body: "Welcome to the intranet\n" },
        },
      },
      "198.51.100.99": { reachable: false, rttMs: 0, ttl: 0, hops: ["10.0.2.2", "198.51.100.1"] },
    },
    listening: [
      { proto: "tcp", addr: "0.0.0.0", port: 22, process: "sshd", pid: 812, backlog: 128 },
      { proto: "tcp", addr: "127.0.0.53%lo", port: 53, process: "systemd-resolve", pid: 455, backlog: 4096 },
      { proto: "udp", addr: "127.0.0.53%lo", port: 53, process: "systemd-resolve", pid: 455 },
    ],
  };
}

export const netShell = () => createShell({ ...fixtureWorld(), network: fixtureNetwork() });
export const netRun = (line: string) => netShell().exec(line);

/** Simulated network for terminal labs. No command ever touches a real network. */

export type Iface = { name: string; mac: string; ipv4?: string /* "10.0.2.15/24" */; ipv6?: string; state: "UP" | "DOWN"; dynamic?: boolean };
export type DnsRecords = {
  A?: string[];
  AAAA?: string[];
  CNAME?: string;
  MX?: { pref: number; host: string }[];
  NS?: string[];
  TXT?: string[];
};
export type HttpResponse = { status: number; reason: string; headers: [string, string][]; body: string };
export type Host = {
  name?: string;
  reachable: boolean;
  rttMs: number;
  ttl: number;
  /** Routers on the way, last entry the host itself; null = a router that doesn't answer. */
  hops: (string | null)[];
  http?: Record<string, HttpResponse>;
  openPorts?: number[];
};
export type Listener = { proto: "tcp" | "udp"; addr: string; port: number; process?: string; pid?: number; backlog?: number };
export type Neighbor = { ip: string; mac: string };

export type Network = {
  interfaces: Iface[];
  gateway: string;
  resolver: string;
  neighbors: Neighbor[];
  /** Keys: lowercase names without a trailing dot. */
  dns: Record<string, DnsRecords>;
  /** Keys: IPv4 addresses. */
  hosts: Record<string, Host>;
  listening: Listener[];
};

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isIpv4(s: string): boolean {
  const m = s.match(IPV4);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
}

const toInt = (ip: string) => ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
const toIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");

/** Address, prefix, network and broadcast of a CIDR like "10.0.2.15/24". */
export function ipv4Info(cidr: string): { ip: string; prefix: number; network: string; broadcast: string } {
  const [ip, p] = cidr.split("/");
  const prefix = Number(p);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const base = toInt(ip) & mask;
  return { ip, prefix, network: toIp(base >>> 0), broadcast: toIp((base | (~mask >>> 0)) >>> 0) };
}

export function ownIpv4(net: Network): string | undefined {
  const iface = net.interfaces.find((i) => i.state === "UP" && i.ipv4);
  return iface?.ipv4 ? ipv4Info(iface.ipv4).ip : undefined;
}

export const normalizeName = (name: string) => name.toLowerCase().replace(/\.$/, "");

/** Follows CNAMEs (max 5) to A records. */
export function resolveName(net: Network, name: string): { ip: string; chain: string[] } | { error: "NXDOMAIN" } {
  let current = normalizeName(name);
  if (current === "localhost") return { ip: "127.0.0.1", chain: [] };
  const chain: string[] = [];
  for (let i = 0; i < 6; i++) {
    const rec = Object.hasOwn(net.dns, current) ? net.dns[current] : undefined;
    if (!rec) return { error: "NXDOMAIN" };
    if (rec.A?.length) return { ip: rec.A[0], chain };
    if (!rec.CNAME) return { error: "NXDOMAIN" };
    chain.push(current);
    current = normalizeName(rec.CNAME);
  }
  return { error: "NXDOMAIN" };
}

/** A command-line target (name or address) → address + the host record, if any. */
export function lookupTarget(net: Network, target: string): { ip: string; host?: Host } | { error: "NXDOMAIN" } {
  const ip = isIpv4(target) ? target : (() => {
    const r = resolveName(net, target);
    return "error" in r ? null : r.ip;
  })();
  if (!ip) return { error: "NXDOMAIN" };
  return { ip, host: Object.hasOwn(net.hosts, ip) ? net.hosts[ip] : undefined };
}

export const isLoopback = (ip: string) => ip.startsWith("127.");

import type { Network, Host } from "@/lib/lab-engine/terminal/network";
import type { Rng } from "../rng";

export function randomMac(rng: Rng, prefix = "52:54:00"): string {
  return `${prefix}:${rng.hex(2)}:${rng.hex(2)}:${rng.hex(2)}`;
}

export type BaseNetworkOptions = {
  subnetPrefix?: number; // e.g. 24..28, default 24
  learnerIp?: string;
  extraHosts?: Record<string, Host>;
  extraDns?: Record<string, { A?: string[]; CNAME?: string }>;
};

/**
 * Builds a seeded office network:
 * - Learner host on 10.<a>.<b>.<c>/prefix (gateway 10.<a>.<b>.1)
 * - Default resolver 10.<a>.<b>.2
 * - 6-10 external/internal hosts using RFC 5737 addresses and .example names
 */
export function baseNetwork(rng: Rng, opts: BaseNetworkOptions = {}): {
  network: Network;
  learnerSubnet: { ip: string; gateway: string; prefix: number; usable: number };
  hosts: { name: string; ip: string; hops: number; reachable: boolean }[];
} {
  const a = rng.int(10, 200);
  const b = rng.int(1, 250);
  const prefix = opts.subnetPrefix ?? 24;
  const usable = Math.pow(2, 32 - prefix) - 2;

  const gatewayIp = `10.${a}.${b}.1`;
  const gatewayMac = randomMac(rng, "52:55:0a");
  const resolverIp = `10.${a}.${b}.2`;
  const hostPart = rng.int(10, Math.min(250, usable));
  const learnerIp = opts.learnerIp ?? `10.${a}.${b}.${hostPart}`;
  const learnerCidr = `${learnerIp}/${prefix}`;

  const hostNames = [
    "relay",
    "gateway",
    "beacon",
    "portal",
    "vault",
    "monitor",
    "backup",
    "auth",
    "matrix",
    "proxy",
  ];
  const chosenNames = rng.shuffle(hostNames).slice(0, rng.int(6, 8));

  const hostList: { name: string; ip: string; hops: number; reachable: boolean }[] = [];
  const networkHosts: Record<string, Host> = { ...opts.extraHosts };
  const dnsRecords: Record<string, { A?: string[]; CNAME?: string }> = { ...opts.extraDns };

  chosenNames.forEach((name, idx) => {
    const fqdn = `${name}.example`;
    const rfcBlock = idx % 3 === 0 ? "192.0.2" : idx % 3 === 1 ? "198.51.100" : "203.0.113";
    const ip = `${rfcBlock}.${rng.int(10, 250)}`;
    const hopCount = rng.int(2, 5);

    const routers: (string | null)[] = [gatewayIp];
    for (let h = 1; h < hopCount - 1; h++) {
      routers.push(h % 2 === 0 ? null : `${rfcBlock}.${h}`);
    }
    routers.push(ip);

    hostList.push({ name: fqdn, ip, hops: hopCount, reachable: true });
    dnsRecords[fqdn] = { A: [ip] };
    networkHosts[ip] = {
      name: fqdn,
      reachable: true,
      rttMs: Number((rng.float(5, 35)).toFixed(1)),
      ttl: 56,
      hops: routers,
      openPorts: [80, 443],
    };
  });

  const network: Network = {
    interfaces: [
      {
        name: "eth0",
        mac: randomMac(rng, "52:54:00"),
        ipv4: learnerCidr,
        ipv6: "fe80::5054:ff:fe12:3456/64",
        state: "UP",
        dynamic: true,
      },
      {
        name: "eth1",
        mac: randomMac(rng, "52:54:00"),
        state: "DOWN",
      },
    ],
    gateway: gatewayIp,
    resolver: resolverIp,
    neighbors: [{ ip: gatewayIp, mac: gatewayMac }],
    dns: dnsRecords,
    hosts: networkHosts,
    listening: [
      { proto: "tcp", addr: "0.0.0.0", port: 22, process: "sshd", pid: 812, backlog: 128 },
    ],
  };

  return {
    network,
    learnerSubnet: { ip: learnerIp, gateway: gatewayIp, prefix, usable },
    hosts: hostList,
  };
}

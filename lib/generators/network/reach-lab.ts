import { file } from "@/lib/lab-engine/terminal/build";
import { baseWorld, pickHostname, pickUsers } from "../terminal/base-world";
import type { Generator } from "../index";
import { baseNetwork } from "./base-network";

/**
 * Rank 1 Networking Lab 2: MAC, ARP, and Reachability
 * Objectives:
 * o1: which of the listed servers in ~/servers.txt is unreachable (unreachable, name)
 * o2: how many hops to beacon.example (hops)
 * o3: the gateway's MAC (gwMac, case-insensitive)
 */
export const reachLab: Generator = (rng) => {
  const [user] = pickUsers(rng, 1);
  const hostname = pickHostname(rng);

  // beacon.example is added below on its own address and routers, so the base network must not use them.
  const beaconIp = "203.0.113.25";
  const beaconRouterIp = (i: number) => `198.51.100.${i + 10}`;
  const { network, hosts } = baseNetwork(rng, {
    reserved: { ips: [beaconIp, ...[1, 2, 3, 4].map(beaconRouterIp)], names: ["beacon"] },
  });

  const beaconHops = rng.int(3, 6);
  const beaconRouters: (string | null)[] = [network.gateway];
  for (let i = 1; i < beaconHops - 1; i++) {
    beaconRouters.push(beaconRouterIp(i));
  }
  beaconRouters.push(beaconIp);

  network.dns["beacon.example"] = { A: [beaconIp] };
  network.hosts[beaconIp] = {
    name: "beacon.example",
    reachable: true,
    rttMs: 18.5,
    ttl: 54,
    hops: beaconRouters,
  };

  // Pick 4-5 servers for ~/servers.txt
  const candidateNames = hosts.map((h) => h.name).filter((n) => n !== "beacon.example");
  const selectedServers = ["beacon.example", ...rng.shuffle(candidateNames).slice(0, 4)];
  rng.shuffle(selectedServers);

  // Pick one server (other than beacon.example) to be unreachable
  const unreachableServer = rng.pick(selectedServers.filter((s) => s !== "beacon.example"));
  const unreachableIp = network.dns[unreachableServer]?.A?.[0];
  if (unreachableIp && network.hosts[unreachableIp]) {
    network.hosts[unreachableIp].reachable = false;
  }

  const serversFileContent = selectedServers.join("\n") + "\n";

  const world = baseWorld({
    user,
    hostname,
    home: {
      "servers.txt": file(serversFileContent, { owner: user }),
    },
  });
  world.network = network;

  const gwMac = network.neighbors[0]?.mac ?? "52:55:0a:00:02:02";

  return {
    env: { kind: "terminal", world },
    answers: {
      unreachable: unreachableServer,
      hops: String(beaconHops),
      gwMac,
    },
  };
};

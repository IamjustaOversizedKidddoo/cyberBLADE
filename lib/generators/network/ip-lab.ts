import { baseWorld, pickHostname, pickUsers } from "../terminal/base-world";
import type { Generator } from "../index";
import { baseNetwork, randomMac } from "./base-network";

/**
 * Rank 1 Networking Lab 1: IP & Subnets
 * Objectives:
 * o1: your IPv4 address (ip)
 * o2: default gateway (gateway)
 * o3: how many usable host addresses on your subnet (usable, prefix /24–/28)
 * o4: which interface is DOWN (downIface)
 */
export const ipLab: Generator = (rng) => {
  const [user] = pickUsers(rng, 1);
  const hostname = pickHostname(rng);
  const prefix = rng.int(24, 28);
  const downIfaceName = rng.pick(["eth1", "eth2", "ens34", "enp0s8"]);

  const { network, learnerSubnet } = baseNetwork(rng, { subnetPrefix: prefix });

  // Add the specific DOWN interface
  network.interfaces = [
    network.interfaces[0],
    {
      name: downIfaceName,
      mac: randomMac(rng, "52:54:00"),
      state: "DOWN",
    },
  ];

  const world = baseWorld({
    user,
    hostname,
  });
  world.network = network;

  return {
    env: { kind: "terminal", world },
    answers: {
      ip: learnerSubnet.ip,
      gateway: learnerSubnet.gateway,
      usable: String(learnerSubnet.usable),
      downIface: downIfaceName,
    },
  };
};

import { ipv4Info } from "../network";
import type { Command } from "./types";
import { fail, ok } from "./util";

const LOOPBACK = [
  "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000",
  "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00",
  "    inet 127.0.0.1/8 scope host lo",
  "       valid_lft forever preferred_lft forever",
];

/** iproute2 `ip` — addr, route and neigh over the simulated network. */
export const ip: Command = {
  name: "ip",
  summary: "show network settings: ip a (addresses), ip route, ip neigh",
  run(ctx) {
    const [object = "", sub] = ctx.argv.slice(1);
    const net = ctx.network;

    if (["a", "addr", "address"].includes(object) && (sub === undefined || sub === "show")) {
      const lines = [...LOOPBACK];
      (net?.interfaces ?? []).forEach((iface, i) => {
        const up = iface.state === "UP";
        lines.push(
          `${i + 2}: ${iface.name}: <BROADCAST,MULTICAST${up ? ",UP,LOWER_UP" : ""}> mtu 1500 qdisc ${up ? "fq_codel" : "noop"} state ${iface.state} group default qlen 1000`,
          `    link/ether ${iface.mac} brd ff:ff:ff:ff:ff:ff`,
        );
        if (iface.ipv4) {
          const info = ipv4Info(iface.ipv4);
          lines.push(
            `    inet ${iface.ipv4} brd ${info.broadcast} scope global ${iface.dynamic ? "dynamic " : ""}${iface.name}`,
            iface.dynamic ? "       valid_lft 86313sec preferred_lft 86313sec" : "       valid_lft forever preferred_lft forever",
          );
        }
        if (iface.ipv6) lines.push(`    inet6 ${iface.ipv6} scope link`, "       valid_lft forever preferred_lft forever");
      });
      return ok(lines.join("\n") + "\n");
    }

    if (["l", "link"].includes(object) && (sub === undefined || sub === "show")) {
      const lines = [LOOPBACK[0], LOOPBACK[1]];
      (net?.interfaces ?? []).forEach((iface, i) => {
        const up = iface.state === "UP";
        lines.push(
          `${i + 2}: ${iface.name}: <BROADCAST,MULTICAST${up ? ",UP,LOWER_UP" : ""}> mtu 1500 qdisc ${up ? "fq_codel" : "noop"} state ${iface.state} group default qlen 1000`,
          `    link/ether ${iface.mac} brd ff:ff:ff:ff:ff:ff`,
        );
      });
      return ok(lines.join("\n") + "\n");
    }

    if (["r", "route"].includes(object)) {
      if (!net) return ok("");
      const lines: string[] = [];
      for (const iface of net.interfaces.filter((i) => i.state === "UP" && i.ipv4)) {
        const info = ipv4Info(iface.ipv4!);
        if (lines.length === 0) lines.push(`default via ${net.gateway} dev ${iface.name} proto dhcp src ${info.ip} metric 100`);
        lines.push(`${info.network}/${info.prefix} dev ${iface.name} proto kernel scope link src ${info.ip} metric 100`);
      }
      return ok(lines.map((l) => `${l}\n`).join(""));
    }

    if (["n", "neigh", "neighbor", "neighbour"].includes(object)) {
      const dev = net?.interfaces.find((i) => i.state === "UP")?.name ?? "eth0";
      return ok((net?.neighbors ?? []).map((n) => `${n.ip} dev ${dev} lladdr ${n.mac} REACHABLE\n`).join(""));
    }

    return fail(`Object "${object}" is unknown, try "ip help".\n`);
  },
};

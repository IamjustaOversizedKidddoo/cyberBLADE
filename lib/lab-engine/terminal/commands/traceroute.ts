import { ipv4Info, lookupTarget } from "../network";
import type { Command } from "./types";
import { fail, ok } from "./util";

const MAX_HOPS = 30;
const hopNo = (k: number) => `${String(k).padStart(2)}  `;
const triple = (base: number) => [base, base + 0.1, base + 0.2].map((t) => `${t.toFixed(3)} ms`).join("  ");

/** traceroute 2.1: the routers between this machine and a host. */
export const traceroute: Command = {
  name: "traceroute",
  summary: "show the routers on the way to a host: traceroute example.com",
  run(ctx) {
    const target = ctx.argv.slice(1).find((a) => !a.startsWith("-"));
    if (!target) return fail("Usage:\n  traceroute [ -46dFITnreAUDV ] host [ packetlen ]\n", 2);
    const net = ctx.network;
    if (!net) return fail("connect: Network is unreachable\n", 1);
    const found = lookupTarget(net, target);
    if ("error" in found) {
      return fail(`${target}: Name or service not known\nCannot handle "host" cmdline arg \`${target}' on position 1 (argc 1)\n`, 2);
    }
    const { ip, host } = found;
    const local = net.interfaces
      .filter((i) => i.ipv4)
      .some((i) => ipv4Info(i.ipv4!).network === ipv4Info(`${ip}/${ipv4Info(i.ipv4!).prefix}`).network);
    const hops = host?.hops ?? (local ? [ip] : [net.gateway]);
    const reachable = !!host?.reachable;
    const name = (addr: string) => (addr === net.gateway ? "_gateway" : Object.hasOwn(net.hosts, addr) ? net.hosts[addr].name ?? addr : addr);

    const lines = [`traceroute to ${target} (${ip}), ${MAX_HOPS} hops max, 60 byte packets`];
    hops.forEach((hop, i) => {
      const k = i + 1;
      if (hop === null) lines.push(`${hopNo(k)}* * *`);
      else if (hop === net.gateway) lines.push(`${hopNo(k)}_gateway (${hop})  0.412 ms  0.398 ms  0.381 ms`);
      else {
        const base = reachable ? (host!.rttMs * k) / hops.length : 2.55 * k;
        lines.push(`${hopNo(k)}${name(hop)} (${hop})  ${triple(base)}`);
      }
    });
    if (!reachable) for (let k = hops.length + 1; k <= MAX_HOPS; k++) lines.push(`${hopNo(k)}* * *`);
    return ok(lines.join("\n") + "\n");
  },
};

import { isIpv4, isLoopback, lookupTarget, ownIpv4 } from "../network";
import type { Command } from "./types";
import { fail, ok } from "./util";

/** iputils prints more decimals for faster replies. */
function fmtTime(ms: number): string {
  if (ms >= 100) return ms.toFixed(0);
  if (ms >= 10) return ms.toFixed(1);
  if (ms >= 1) return ms.toFixed(2);
  return ms.toFixed(3);
}

function parse(args: string[]): { count?: string; target?: string } {
  let count: string | undefined;
  let target: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-c") count = args[++i] ?? "";
    else if (a.startsWith("-c")) count = a.slice(2);
    else if (!a.startsWith("-") && target === undefined) target = a;
  }
  return { count, target };
}

export const ping: Command = {
  name: "ping",
  summary: "check if a host answers: ping -c 4 example.com",
  run(ctx) {
    const { count, target } = parse(ctx.argv.slice(1));
    if (!target) return fail("ping: usage error: Destination address required\n", 1);
    if (count === undefined) return fail("ping: this lab needs -c <count> — real ping keeps going until you press Ctrl+C\n", 2);
    if (!/^\d+$/.test(count)) return fail(`ping: invalid argument: '${count}'\n`, 2);
    const n = Number(count);
    if (n < 1 || n > 10) return fail("ping: this lab sends 1 to 10 packets (-c 1 … -c 10)\n", 2);

    const net = ctx.network;
    const self = net ? ownIpv4(net) : undefined;
    let ip: string;
    let rtt: number;
    let ttl: number;
    let reachable: boolean;
    let shownName: string | undefined;

    if (isIpv4(target) && (isLoopback(target) || target === self)) {
      [ip, rtt, ttl, reachable] = [target, 0.03, 64, true];
    } else {
      if (!net || !self) return fail("ping: connect: Network is unreachable\n", 2);
      const found = lookupTarget(net, target);
      if ("error" in found) return fail(`ping: ${target}: Name or service not known\n`, 2);
      ip = found.ip;
      reachable = !!found.host?.reachable;
      rtt = found.host?.rttMs ?? 0;
      ttl = found.host?.ttl ?? 64;
      if (!isIpv4(target)) shownName = found.host?.name ?? target.toLowerCase();
    }

    const lines = [`PING ${target} (${ip}) 56(84) bytes of data.`];
    const time = n === 1 ? 0 : (n - 1) * 1000 + 4;
    if (!reachable) {
      for (let i = 1; i <= n; i++) lines.push(`From ${self} icmp_seq=${i} Destination Host Unreachable`);
      lines.push("", `--- ${target} ping statistics ---`, `${n} packets transmitted, 0 received, +${n} errors, 100% packet loss, time ${time}ms`, "");
      return { stdout: lines.join("\n"), stderr: "", code: 1 };
    }
    const times = Array.from({ length: n }, (_, i) => rtt + i * 0.1);
    const from = shownName ? `${shownName} (${ip})` : ip;
    times.forEach((t, i) => lines.push(`64 bytes from ${from}: icmp_seq=${i + 1} ttl=${ttl} time=${fmtTime(t)} ms`));
    const avg = times.reduce((a, b) => a + b, 0) / n;
    const mdev = Math.sqrt(times.reduce((a, t) => a + (t - avg) ** 2, 0) / n);
    lines.push(
      "",
      `--- ${target} ping statistics ---`,
      `${n} packets transmitted, ${n} received, 0% packet loss, time ${time}ms`,
      `rtt min/avg/max/mdev = ${[Math.min(...times), avg, Math.max(...times), mdev].map((v) => v.toFixed(3)).join("/")} ms`,
      "",
    );
    return ok(lines.join("\n"));
  },
};

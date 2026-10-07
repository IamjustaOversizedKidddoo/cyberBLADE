import { describe, expect, it } from "vitest";
import { checkObjective } from "@/lib/lab-engine/checks";
import { openLab, SEEDS } from "./helpers";

describe("core-r1-net-ip-lab-01", () => {
  it.each(SEEDS)("solves lab with seed %s using shell commands", async (seed) => {
    const { run, check, lab, answers } = await openLab("core-r1-net-ip-lab-01", seed);

    // o1: your IPv4 address from `ip a`
    const ipOut = run("ip a").stdout;
    const ipMatches = [...ipOut.matchAll(/inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/g)];
    const nonLoopback = ipMatches.find((m) => m[1] !== "127.0.0.1");
    expect(nonLoopback).toBeDefined();
    const ownIp = nonLoopback![1];
    const prefix = Number(nonLoopback![2]);

    expect(check("o1", ownIp)).toBe(true);

    // Review Focus #4: trailing/leading whitespace trimmed, but invalid IP suffix rejected
    expect(checkObjective(lab, answers, "o1", `  ${ownIp}  \n`)).toBe(true);
    expect(checkObjective(lab, answers, "o1", `${ownIp}.`)).toBe(false);

    // o2: default gateway from `ip route`
    const routeOut = run("ip route").stdout;
    const gwMatch = routeOut.match(/default via (\d+\.\d+\.\d+\.\d+)/);
    expect(gwMatch).not.toBeNull();
    const gw = gwMatch![1];
    expect(check("o2", gw)).toBe(true);

    // o3: usable addresses calculation: 2^(32 - prefix) - 2
    const usable = Math.pow(2, 32 - prefix) - 2;
    expect(check("o3", String(usable))).toBe(true);

    // o4: down interface from `ip link` or `ip a`
    const linkOut = run("ip link").stdout;
    const downMatch = linkOut.match(/\d+:\s+([a-zA-Z0-9_-]+):[^\n]*state DOWN/);
    expect(downMatch).not.toBeNull();
    const downIface = downMatch![1];
    expect(check("o4", downIface)).toBe(true);
  });
});

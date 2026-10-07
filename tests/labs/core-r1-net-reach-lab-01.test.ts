import { describe, expect, it } from "vitest";
import { MANY_SEEDS, openLab, SEEDS } from "./helpers";

describe("core-r1-net-reach-lab-01", () => {
  it.each(SEEDS)("solves lab with seed %s using shell commands", async (seed) => {
    const { run, check } = await openLab("core-r1-net-reach-lab-01", seed);

    // o1: identify unreachable server from ~/servers.txt using ping
    const servers = run("cat ~/servers.txt")
      .stdout.trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    let unreachable = "";
    for (const server of servers) {
      const pingRes = run(`ping -c 1 ${server}`);
      if (pingRes.code !== 0 || pingRes.stdout.includes("100% packet loss")) {
        unreachable = server;
        break;
      }
    }
    expect(unreachable).not.toBe("");
    expect(check("o1", unreachable)).toBe(true);

    // o2: hop count to beacon.example via traceroute
    const traceOut = run("traceroute beacon.example").stdout;
    const traceLines = traceOut
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+\s+/.test(l));
    const hopCount = traceLines.length;
    expect(hopCount).toBeGreaterThan(0);
    expect(check("o2", String(hopCount))).toBe(true);

    // o3: default gateway MAC from `ip neigh` (case-insensitive)
    const neighOut = run("ip neigh").stdout;
    const macMatch = neighOut.match(/([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/);
    expect(macMatch).not.toBeNull();
    const mac = macMatch![1];
    expect(check("o3", mac)).toBe(true);
    expect(check("o3", mac.toUpperCase())).toBe(true);
  });
});

describe("core-r1-net-reach-lab-01 across many seeds", () => {
  it("exactly one listed server is down, and beacon's traceroute gives the answer", async () => {
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { run, check } = await openLab("core-r1-net-reach-lab-01", seed);
      const servers = run("cat ~/servers.txt").stdout.trim().split("\n");
      const down = servers.filter((s) => run(`ping -c 1 ${s}`).code !== 0);
      const hops = run("traceroute beacon.example").stdout.trim().split("\n").filter((l) => /^\s*\d+\s+/.test(l)).length;
      if (down.length !== 1 || !check("o1", down[0]) || !check("o2", String(hops))) bad.push(`${seed}: down=${down.join(",")} hops=${hops}`);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

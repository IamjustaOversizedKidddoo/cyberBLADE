import { describe, expect, it } from "vitest";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { MANY_SEEDS, openPacketLab, SEEDS } from "./helpers";

describe("core-r1-pkt-scan-lab-01", () => {
  it.each(SEEDS)("solves lab with seed %s using Wireshark filters", async (seed) => {
    const { capture, check } = await openPacketLab("core-r1-pkt-scan-lab-01", seed);

    // Filter for initial SYN probes: tcp.flags.syn == 1 && tcp.flags.ack == 0
    const synFilter = compileFilter("tcp.flags.syn == 1 && tcp.flags.ack == 0");
    expect(synFilter.ok).toBe(true);
    if (!synFilter.ok) return;

    const synPackets = capture.packets.filter(synFilter.test);
    expect(synPackets.length).toBeGreaterThan(0);

    // o1: scanner IP
    const scanner = synPackets[0].ip?.src;
    expect(scanner).toBeDefined();
    expect(check("o1", scanner!)).toBe(true);

    // o3: number of probed ports
    const probedPorts = new Set(synPackets.map((p) => p.tcp?.dstport));
    expect(check("o3", String(probedPorts.size))).toBe(true);

    // Filter for SYN-ACK responses: tcp.flags.syn == 1 && tcp.flags.ack == 1
    const synAckFilter = compileFilter("tcp.flags.syn == 1 && tcp.flags.ack == 1");
    expect(synAckFilter.ok).toBe(true);
    if (!synAckFilter.ok) return;

    const synAckPackets = capture.packets.filter(synAckFilter.test);
    const openPorts = Array.from(new Set(synAckPackets.map((p) => p.tcp?.srcport)))
      .sort((a, b) => a! - b!)
      .join(",");

    expect(check("o2", openPorts)).toBe(true);
  });
});

describe("core-r1-pkt-scan-lab-01 across many seeds", () => {
  it("one scanner, at least two open ports, and no open-port answer is common enough to guess", async () => {
    const syn = compileFilter("tcp.flags.syn == 1 && tcp.flags.ack == 0");
    const counts = new Map<string, number>();
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { capture, answers } = await openPacketLab("core-r1-pkt-scan-lab-01", seed);
      if (!syn.ok) throw new Error("filter");
      const sources = new Set(capture.packets.filter(syn.test).map((p) => p.ip?.src));
      if (sources.size !== 1 || answers.openPorts.split(",").length < 2) bad.push(`${seed}: ${[...sources]} ${answers.openPorts}`);
      counts.set(answers.openPorts, (counts.get(answers.openPorts) ?? 0) + 1);
    }
    expect(bad).toEqual([]);
    expect(Math.max(...counts.values()) / MANY_SEEDS.length).toBeLessThan(0.05);
  }, 120_000);

  it("the prompt gives no example that could be an answer", async () => {
    const { lab } = await openPacketLab("core-r1-pkt-scan-lab-01", "seed-a");
    expect(lab.objectives.find((o) => o.id === "o2")!.prompt).not.toMatch(/e\.g\./);
  });
});

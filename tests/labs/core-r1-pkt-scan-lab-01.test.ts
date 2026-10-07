import { describe, expect, it } from "vitest";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { openPacketLab, SEEDS } from "./helpers";

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

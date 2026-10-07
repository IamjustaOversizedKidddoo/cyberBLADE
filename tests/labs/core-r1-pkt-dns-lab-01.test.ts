import { describe, expect, it } from "vitest";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { infoOf } from "@/lib/lab-engine/packet/summary";
import { MANY_SEEDS, openPacketLab, SEEDS } from "./helpers";

describe("core-r1-pkt-dns-lab-01", () => {
  it.each(SEEDS)("solves lab with seed %s using Wireshark filters", async (seed) => {
    const { capture, check } = await openPacketLab("core-r1-pkt-dns-lab-01", seed);

    // o1: find the domain that returned NXDOMAIN
    const respFilter = compileFilter("dns.flags.response == 1");
    expect(respFilter.ok).toBe(true);
    if (!respFilter.ok) return;

    const respPackets = capture.packets.filter(respFilter.test);
    const nxPacket = respPackets.find((p) => p.dns?.rcode === "NXDOMAIN");
    expect(nxPacket).toBeDefined();
    const nxdomain = nxPacket!.dns!.qname;
    expect(check("o1", nxdomain)).toBe(true);
    // Review Focus #4: case-insensitive check
    expect(check("o1", nxdomain.toUpperCase())).toBe(true);

    // o2: IP beacon.example resolved to
    const beaconFilter = compileFilter('dns.qry.name == "beacon.example" && dns.flags.response == 1');
    expect(beaconFilter.ok).toBe(true);
    if (!beaconFilter.ok) return;

    const beaconPacket = capture.packets.find(beaconFilter.test);
    expect(beaconPacket).toBeDefined();
    const resolvedIp = beaconPacket!.dns?.answers?.[0]?.data;
    expect(resolvedIp).toBeDefined();
    expect(check("o2", resolvedIp!)).toBe(true);

    // o3: host that sent the most DNS queries
    const queryFilter = compileFilter("dns.flags.response == 0");
    expect(queryFilter.ok).toBe(true);
    if (!queryFilter.ok) return;

    const queryPackets = capture.packets.filter(queryFilter.test);
    const counts = new Map<string, number>();
    for (const p of queryPackets) {
      const src = p.ip?.src;
      if (src) {
        counts.set(src, (counts.get(src) ?? 0) + 1);
      }
    }

    let chattyHost = "";
    let maxQueries = 0;
    for (const [ip, count] of counts.entries()) {
      if (count > maxQueries) {
        maxQueries = count;
        chattyHost = ip;
      }
    }

    expect(chattyHost).not.toBe("");
    expect(check("o3", chattyHost)).toBe(true);
  });
});

describe("core-r1-pkt-dns-lab-01 across many seeds", () => {
  it("the chatty host must be counted: queries are interleaved, the top count is unique, each client has its own MAC", async () => {
    const queries = compileFilter("dns.flags.response == 0");
    if (!queries.ok) throw new Error("filter");
    const bad: string[] = [];
    for (const seed of MANY_SEEDS) {
      const { capture, answers } = await openPacketLab("core-r1-pkt-dns-lab-01", seed);
      const qs = capture.packets.filter(queries.test);
      const counts = new Map<string, number>();
      const macs = new Map<string, Set<string>>();
      for (const p of qs) {
        counts.set(p.ip!.src, (counts.get(p.ip!.src) ?? 0) + 1);
        macs.set(p.ip!.src, (macs.get(p.ip!.src) ?? new Set()).add(p.eth!.src));
      }
      const sorted = [...counts.values()].sort((a, b) => b - a);
      const top = counts.get(answers.chatty)!;
      const leading = qs.slice(0, top).every((p) => p.ip!.src === answers.chatty);
      const distinctMacs = new Set([...macs.values()].flatMap((s) => [...s]));
      if (top !== sorted[0] || sorted[0] === sorted[1] || leading || distinctMacs.size !== counts.size || [...macs.values()].some((s) => s.size !== 1))
        bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

it("the last o1 hint quotes words that really appear in the NXDOMAIN response's Info column", async () => {
  const { lab, capture } = await openPacketLab("core-r1-pkt-dns-lab-01", "seed-a");
  const nx = capture.packets.find((p) => p.dns?.rcode === "NXDOMAIN")!;
  const hint = lab.hints.o1.at(-1)!;
  const quoted = hint.match(/"([^"]+)"/)?.[1];
  expect(quoted).toBeDefined();
  expect(infoOf(nx)).toContain(quoted);
});

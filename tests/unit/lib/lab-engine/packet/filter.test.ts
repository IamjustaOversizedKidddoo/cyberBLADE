import { describe, expect, it } from "vitest";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { FIXTURE_CAPTURE } from "./fixture-capture";
import type { Packet } from "@/lib/lab-engine/packet/types";

describe("packet display filters", () => {
  const { packets } = FIXTURE_CAPTURE;

  function filter(src: string): number[] {
    const res = compileFilter(src);
    if (!res.ok) throw new Error(`Filter failed: ${res.error}`);
    return packets.filter(res.test).map((p) => p.no);
  }

  it("empty string matches everything", () => {
    expect(filter("")).toEqual(packets.map((p) => p.no));
    expect(filter("   ")).toEqual(packets.map((p) => p.no));
  });

  it("filters by bare protocol name", () => {
    expect(filter("arp")).toEqual([1, 2]);
    expect(filter("dns")).toEqual([3, 4]);
    expect(filter("http")).toEqual([8, 9]);
    expect(filter("tls")).toEqual([11]);
    expect(filter("icmp")).toEqual([12]);
    expect(filter("udp")).toEqual([3, 4]);
    expect(filter("tcp")).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  it("filters by negation (! and not)", () => {
    const withoutDns = packets.filter((p) => p.no !== 3 && p.no !== 4).map((p) => p.no);
    expect(filter("!dns")).toEqual(withoutDns);
    expect(filter("not dns")).toEqual(withoutDns);
  });

  it("filters by ip.addr, ip.src, ip.dst", () => {
    expect(filter("ip.src == 10.0.2.15")).toEqual([3, 5, 7, 8, 11, 12]);
    expect(filter("ip.dst == 10.0.2.15")).toEqual([4, 6, 9, 10]);
    expect(filter("ip.addr == 203.0.113.10")).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("filters by tcp ports and flags", () => {
    expect(filter("tcp.port == 80")).toEqual([5, 6, 7, 8, 9, 10]);
    expect(filter("tcp.dstport == 80")).toEqual([5, 7, 8]);
    expect(filter("tcp.srcport == 80")).toEqual([6, 9, 10]);
    expect(filter("tcp.flags.syn == 1 && tcp.flags.ack == 0")).toEqual([5]);
    expect(filter("tcp.flags.syn == 1 && tcp.flags.ack == 1")).toEqual([6]);
    expect(filter("tcp.flags.reset == 1")).toEqual([10]);
  });

  it("filters by udp ports", () => {
    expect(filter("udp.port == 53")).toEqual([3, 4]);
    expect(filter("udp.dstport == 53")).toEqual([3]);
    expect(filter("udp.srcport == 53")).toEqual([4]);
  });

  it("filters with combined expressions (&&, and, ||, or, parentheses)", () => {
    expect(filter("ip.addr == 10.0.2.15 && tcp.port == 80")).toEqual([5, 6, 7, 8, 9, 10]);
    expect(filter("ip.addr == 10.0.2.15 and tcp.port == 80")).toEqual([5, 6, 7, 8, 9, 10]);
    expect(filter("(tcp.dstport == 80 || tcp.dstport == 443) && ip.src == 10.0.2.15")).toEqual([5, 7, 8, 11]);
  });

  it("filters string fields with contains and ==", () => {
    expect(filter('dns.qry.name contains "example"')).toEqual([3, 4]);
    expect(filter('dns.qry.name == "example.com"')).toEqual([3, 4]);
    expect(filter('http.request.method == "POST"')).toEqual([8]);
    expect(filter('http.request.uri contains "login"')).toEqual([8]);
    expect(filter("http.response.code == 200")).toEqual([9]);
    expect(filter('tls.handshake.extensions_server_name == "secure.example.com"')).toEqual([11]);
    expect(filter('tls.handshake.extensions_server_name contains "example"')).toEqual([11]);
  });

  it("filters frame.number", () => {
    expect(filter("frame.number == 8")).toEqual([8]);
    expect(filter("frame.number <= 3")).toEqual([1, 2, 3]);
  });

  it("searches packet text using frame contains", () => {
    expect(filter('frame contains "password"')).toEqual([8]);
    expect(filter('frame contains "Welcome"')).toEqual([9]);
    expect(filter('frame contains "nonexistent"')).toEqual([]);
  });

  describe("exact error messages", () => {
    it("reports = instead of == error", () => {
      const res = compileFilter("ip.addr = 10.0.2.15");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('\"=\" is not a valid operator — use \"==\"');
    });

    it("reports unknown protocol or field error", () => {
      const res = compileFilter("unknown.field == 123");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('\"unknown.field\" is not a valid protocol or field');
    });

    it("reports unbalanced parentheses error", () => {
      const res = compileFilter("(ip.addr == 10.0.2.15");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("Unbalanced parentheses");
    });

    it("reports expected a value after operator error", () => {
      const res = compileFilter("ip.src ==");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('Expected a value after \"==\"');
    });
  });

  describe("performance over 3,000 packets", () => {
    it("evaluates a complex filter over 3,000 packets in under 50ms", () => {
      const largeCapture: Packet[] = Array.from({ length: 3000 }, (_, i) => ({
        no: i + 1,
        time: i * 0.001,
        length: 100,
        eth: { src: "00:11:22:33:44:55", dst: "66:77:88:99:aa:bb" },
        ip: { src: `10.0.${Math.floor(i / 256)}.${i % 256}`, dst: "192.168.1.1", ttl: 64, version: 4 },
        tcp: {
          srcport: 10000 + (i % 20000),
          dstport: i % 2 === 0 ? 80 : 443,
          seq: i * 100,
          ack: 0,
          flags: { syn: true, ack: false, fin: false, rst: false, psh: false },
          payload: i % 5 === 0 ? `payload with x for packet ${i}` : `clean payload ${i}`,
        },
      }));

      const compiled = compileFilter('tcp.port == 80 and frame contains "x"');
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;

      const t0 = performance.now();
      const matched = largeCapture.filter(compiled.test);
      const elapsed = performance.now() - t0;

      expect(matched.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(50);
    });
  });
});

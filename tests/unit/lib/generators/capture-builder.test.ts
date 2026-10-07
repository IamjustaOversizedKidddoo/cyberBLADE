import { describe, expect, it } from "vitest";
import { CaptureBuilder } from "@/lib/generators/packet/capture-builder";
import { scanLab } from "@/lib/generators/packet/scan-lab";
import { dnsLab } from "@/lib/generators/packet/dns-lab";
import { httpLab } from "@/lib/generators/packet/http-lab";
import { createRng } from "@/lib/generators/rng";

describe("CaptureBuilder", () => {
  it("builds packet captures with realistic protocols and timestamps", () => {
    const builder = new CaptureBuilder("test.pcap");
    builder.addArpPair("10.0.2.15", "10.0.2.1", "00:11:22:33:44:55", "52:55:0a:00:02:02");
    builder.addDnsQuery("10.0.2.15", "10.0.2.2", "00:11:22:33:44:55", "52:55:0a:00:02:02", "example.com", 0x1234);
    builder.addDnsResponse(
      "10.0.2.15",
      "10.0.2.2",
      "00:11:22:33:44:55",
      "52:55:0a:00:02:02",
      "example.com",
      0x1234,
      [{ name: "example.com", type: "A", data: "93.184.216.34", ttl: 300 }],
    );

    const capture = builder.build();
    expect(capture.name).toBe("test.pcap");
    expect(capture.packets).toHaveLength(4);
    expect(capture.packets[0].no).toBe(1);
    expect(capture.packets[1].no).toBe(2);
    expect(capture.packets[2].no).toBe(3);
    expect(capture.packets[3].no).toBe(4);
    expect(capture.packets[3].time).toBeGreaterThan(capture.packets[0].time);
  });

  it("throws if capture exceeds 3,000 packet limit", () => {
    const builder = new CaptureBuilder("huge.pcap");
    for (let i = 0; i < 1501; i++) {
      builder.addArpPair("10.0.0.1", "10.0.0.2", "00:11:22:33:44:55", "66:77:88:99:aa:bb");
    }
    expect(() => builder.build()).toThrow(/exceeds 3,000 packet limit/);
  });

  it("all 3 packet lab generators produce captures with <= 3,000 packets across multiple seeds", () => {
    const seeds = ["seed-1", "seed-42", "seed-100", "test-learner", "exam-seed"];
    for (const seed of seeds) {
      const rng1 = createRng(`scan:${seed}`);
      const scanOut = scanLab(rng1, {});
      if (scanOut.env.kind === "packet") {
        expect(scanOut.env.capture.packets.length).toBeLessThanOrEqual(3000);
        expect(scanOut.env.capture.packets.length).toBeGreaterThan(0);
      }

      const rng2 = createRng(`dns:${seed}`);
      const dnsOut = dnsLab(rng2, {});
      if (dnsOut.env.kind === "packet") {
        expect(dnsOut.env.capture.packets.length).toBeLessThanOrEqual(3000);
        expect(dnsOut.env.capture.packets.length).toBeGreaterThan(0);
      }

      const rng3 = createRng(`http:${seed}`);
      const httpOut = httpLab(rng3, {});
      if (httpOut.env.kind === "packet") {
        expect(httpOut.env.capture.packets.length).toBeLessThanOrEqual(3000);
        expect(httpOut.env.capture.packets.length).toBeGreaterThan(0);
      }
    }
  });
});

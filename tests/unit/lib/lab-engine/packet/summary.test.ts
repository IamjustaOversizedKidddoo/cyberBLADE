import { describe, expect, it } from "vitest";
import { infoOf, protocolOf } from "@/lib/lab-engine/packet/summary";
import { FIXTURE_CAPTURE } from "./fixture-capture";

describe("packet summary", () => {
  const [arpReq, arpReply, dnsQry, dnsResp, tcpSyn, tcpSynAck, tcpAck, httpPost, http200, tcpRst, tlsHello, icmpEcho] =
    FIXTURE_CAPTURE.packets;

  describe("protocolOf", () => {
    it("identifies the most specific protocol layer", () => {
      expect(protocolOf(arpReq)).toBe("ARP");
      expect(protocolOf(arpReply)).toBe("ARP");
      expect(protocolOf(dnsQry)).toBe("DNS");
      expect(protocolOf(dnsResp)).toBe("DNS");
      expect(protocolOf(tcpSyn)).toBe("TCP");
      expect(protocolOf(tcpSynAck)).toBe("TCP");
      expect(protocolOf(tcpAck)).toBe("TCP");
      expect(protocolOf(httpPost)).toBe("HTTP");
      expect(protocolOf(http200)).toBe("HTTP");
      expect(protocolOf(tcpRst)).toBe("TCP");
      expect(protocolOf(tlsHello)).toBe("TLSv1.3");
      expect(protocolOf(icmpEcho)).toBe("ICMP");
    });
  });

  describe("infoOf", () => {
    it("formats ARP request and reply in Wireshark style", () => {
      expect(infoOf(arpReq)).toBe("Who has 10.0.2.2? Tell 10.0.2.15");
      expect(infoOf(arpReply)).toBe("10.0.2.2 is at 52:55:0a:00:02:02");
    });

    it("formats DNS query and response in Wireshark style", () => {
      expect(infoOf(dnsQry)).toBe("Standard query 0x1a2b A example.com");
      expect(infoOf(dnsResp)).toBe("Standard query response 0x1a2b A example.com A 203.0.113.10");
    });

    it("formats TCP packets with flags, seq, ack in Wireshark style", () => {
      expect(infoOf(tcpSyn)).toContain("51514 → 80 [SYN]");
      expect(infoOf(tcpSynAck)).toContain("80 → 51514 [SYN, ACK]");
      expect(infoOf(tcpRst)).toContain("80 → 51514 [RST]");
    });

    it("formats HTTP request and response in Wireshark style", () => {
      expect(infoOf(httpPost)).toBe("POST /login HTTP/1.1");
      expect(infoOf(http200)).toBe("HTTP/1.1 200 OK  (text/html)");
    });

    it("formats TLS ClientHello with SNI in Wireshark style", () => {
      expect(infoOf(tlsHello)).toBe("Client Hello (SNI=secure.example.com)");
    });

    it("formats ICMP echo request", () => {
      expect(infoOf(icmpEcho)).toContain("Echo (ping) request");
    });
  });
});

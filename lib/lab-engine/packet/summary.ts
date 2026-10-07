import type { Packet } from "./types";

export type Protocol = "ARP" | "ICMP" | "DNS" | "HTTP" | "TLSv1.3" | "TCP" | "UDP";

/** Returns the most specific protocol layer present in the packet. */
export function protocolOf(p: Packet): Protocol {
  if (p.tls) return "TLSv1.3";
  if (p.http) return "HTTP";
  if (p.dns) return "DNS";
  if (p.icmp) return "ICMP";
  if (p.tcp) return "TCP";
  if (p.udp) return "UDP";
  if (p.arp) return "ARP";
  return "TCP";
}

/** Formats a packet's Info column in Wireshark style. */
export function infoOf(p: Packet): string {
  if (p.arp) {
    if (p.arp.op === "request") {
      return `Who has ${p.arp.targetIp}? Tell ${p.arp.senderIp}`;
    }
    return `${p.arp.senderIp} is at ${p.arp.senderMac}`;
  }

  if (p.http) {
    if (p.http.request) {
      return `${p.http.request.method} ${p.http.request.uri} HTTP/1.1`;
    }
    if (p.http.response) {
      const ctHeader = p.http.response.headers?.find(([k]) => k.toLowerCase() === "content-type");
      const ct = ctHeader ? `  (${ctHeader[1]})` : "";
      return `HTTP/1.1 ${p.http.response.code} ${p.http.response.phrase}${ct}`;
    }
  }

  if (p.tls) {
    if (p.tls.handshake === "ClientHello") {
      return `Client Hello${p.tls.sni ? ` (SNI=${p.tls.sni})` : ""}`;
    }
    if (p.tls.handshake === "ServerHello") {
      return "Server Hello";
    }
    if (p.tls.appData) {
      return "Application Data";
    }
  }

  if (p.dns) {
    const idHex = `0x${p.dns.id.toString(16).padStart(4, "0")}`;
    if (!p.dns.response) {
      return `Standard query ${idHex} ${p.dns.qtype} ${p.dns.qname}`;
    }
    if (p.dns.rcode === "NXDOMAIN") {
      return `Standard query response ${idHex} No such name ${p.dns.qtype} ${p.dns.qname}`;
    }
    const answersText = p.dns.answers && p.dns.answers.length > 0
      ? " " + p.dns.answers.map((a) => `${a.type} ${a.data}`).join(" ")
      : "";
    return `Standard query response ${idHex} ${p.dns.qtype} ${p.dns.qname}${answersText}`;
  }

  if (p.icmp) {
    if (p.icmp.type === 8) return "Echo (ping) request";
    if (p.icmp.type === 0) return "Echo (ping) reply";
    return `ICMP type ${p.icmp.type} code ${p.icmp.code}`;
  }

  if (p.tcp) {
    const flags: string[] = [];
    if (p.tcp.flags.syn) flags.push("SYN");
    if (p.tcp.flags.fin) flags.push("FIN");
    if (p.tcp.flags.rst) flags.push("RST");
    if (p.tcp.flags.psh) flags.push("PSH");
    if (p.tcp.flags.ack) flags.push("ACK");
    const flagsStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    const len = p.tcp.payload ? p.tcp.payload.length : 0;
    return `${p.tcp.srcport} → ${p.tcp.dstport}${flagsStr} Seq=${p.tcp.seq} Ack=${p.tcp.ack} Win=64240 Len=${len}`;
  }

  if (p.udp) {
    return `${p.udp.srcport} → ${p.udp.dstport} Len=${p.length}`;
  }

  return "";
}

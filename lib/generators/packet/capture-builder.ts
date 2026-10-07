import type { Packet, Capture } from "@/lib/lab-engine/packet/types";

export class CaptureBuilder {
  private packets: Packet[] = [];
  private currentTime = 0;
  private currentNo = 1;

  constructor(private name: string = "capture.pcap") {}

  private nextNo(): number {
    return this.currentNo++;
  }

  private advanceTime(deltaSeconds: number = 0.001): number {
    this.currentTime += deltaSeconds;
    return Number(this.currentTime.toFixed(6));
  }

  addArpPair(senderIp: string, targetIp: string, senderMac: string, targetMac: string, delta = 0.0005) {
    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 42,
      eth: { src: senderMac, dst: "ff:ff:ff:ff:ff:ff" },
      arp: { op: "request", senderIp, targetIp, senderMac },
    });

    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 42,
      eth: { src: targetMac, dst: senderMac },
      arp: { op: "reply", senderIp: targetIp, targetIp: senderIp, senderMac: targetMac },
    });
  }

  addDnsQuery(
    clientIp: string,
    serverIp: string,
    clientMac: string,
    serverMac: string,
    qname: string,
    id: number,
    srcPort = 53535,
    delta = 0.001,
  ) {
    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 64 + qname.length,
      eth: { src: clientMac, dst: serverMac },
      ip: { src: clientIp, dst: serverIp, ttl: 64, version: 4 },
      udp: { srcport: srcPort, dstport: 53 },
      dns: { id, response: false, qname, qtype: "A" },
    });
  }

  addDnsResponse(
    clientIp: string,
    serverIp: string,
    clientMac: string,
    serverMac: string,
    qname: string,
    id: number,
    answers?: { name: string; type: string; data: string; ttl: number }[],
    rcode: "NOERROR" | "NXDOMAIN" = "NOERROR",
    srcPort = 53535,
    delta = 0.002,
  ) {
    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 80 + (answers ? answers.length * 16 : 0),
      eth: { src: serverMac, dst: clientMac },
      ip: { src: serverIp, dst: clientIp, ttl: 64, version: 4 },
      udp: { srcport: 53, dstport: srcPort },
      dns: { id, response: true, qname, qtype: "A", rcode, answers },
    });
  }

  addTcpHandshake(
    clientIp: string,
    serverIp: string,
    clientMac: string,
    serverMac: string,
    clientPort: number,
    serverPort: number,
    delta = 0.001,
  ) {
    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 74,
      eth: { src: clientMac, dst: serverMac },
      ip: { src: clientIp, dst: serverIp, ttl: 64, version: 4 },
      tcp: {
        srcport: clientPort,
        dstport: serverPort,
        seq: 0,
        ack: 0,
        flags: { syn: true, ack: false, fin: false, rst: false, psh: false },
      },
    });

    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 74,
      eth: { src: serverMac, dst: clientMac },
      ip: { src: serverIp, dst: clientIp, ttl: 56, version: 4 },
      tcp: {
        srcport: serverPort,
        dstport: clientPort,
        seq: 0,
        ack: 1,
        flags: { syn: true, ack: true, fin: false, rst: false, psh: false },
      },
    });

    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 66,
      eth: { src: clientMac, dst: serverMac },
      ip: { src: clientIp, dst: serverIp, ttl: 64, version: 4 },
      tcp: {
        srcport: clientPort,
        dstport: serverPort,
        seq: 1,
        ack: 1,
        flags: { syn: false, ack: true, fin: false, rst: false, psh: false },
      },
    });
  }

  addTcpProbeClosed(
    clientIp: string,
    serverIp: string,
    clientMac: string,
    serverMac: string,
    clientPort: number,
    serverPort: number,
    delta = 0.001,
  ) {
    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 74,
      eth: { src: clientMac, dst: serverMac },
      ip: { src: clientIp, dst: serverIp, ttl: 64, version: 4 },
      tcp: {
        srcport: clientPort,
        dstport: serverPort,
        seq: 0,
        ack: 0,
        flags: { syn: true, ack: false, fin: false, rst: false, psh: false },
      },
    });

    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 60,
      eth: { src: serverMac, dst: clientMac },
      ip: { src: serverIp, dst: clientIp, ttl: 56, version: 4 },
      tcp: {
        srcport: serverPort,
        dstport: clientPort,
        seq: 0,
        ack: 1,
        flags: { syn: false, ack: false, fin: false, rst: true, psh: false },
      },
    });
  }

  addHttpExchange(
    clientIp: string,
    serverIp: string,
    clientMac: string,
    serverMac: string,
    clientPort: number,
    serverPort: number,
    request: { method: string; uri: string; host: string; headers?: [string, string][]; body?: string },
    response: { code: number; phrase: string; headers?: [string, string][]; body?: string },
    delta = 0.002,
  ) {
    const reqHeaders = request.headers ?? [["Host", request.host]];
    const reqPayload = `${request.method} ${request.uri} HTTP/1.1\r\n${reqHeaders.map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n${request.body ?? ""}`;

    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 66 + reqPayload.length,
      eth: { src: clientMac, dst: serverMac },
      ip: { src: clientIp, dst: serverIp, ttl: 64, version: 4 },
      tcp: {
        srcport: clientPort,
        dstport: serverPort,
        seq: 1,
        ack: 1,
        flags: { syn: false, ack: true, fin: false, rst: false, psh: true },
        payload: reqPayload,
      },
      http: {
        request: {
          method: request.method,
          uri: request.uri,
          host: request.host,
          headers: reqHeaders,
          body: request.body,
        },
      },
    });

    const respHeaders = response.headers ?? [["Content-Type", "text/html"]];
    const respPayload = `HTTP/1.1 ${response.code} ${response.phrase}\r\n${respHeaders.map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n${response.body ?? ""}`;

    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 66 + respPayload.length,
      eth: { src: serverMac, dst: clientMac },
      ip: { src: serverIp, dst: clientIp, ttl: 56, version: 4 },
      tcp: {
        srcport: serverPort,
        dstport: clientPort,
        seq: 1,
        ack: 1 + reqPayload.length,
        flags: { syn: false, ack: true, fin: false, rst: false, psh: true },
        payload: respPayload,
      },
      http: {
        response: {
          code: response.code,
          phrase: response.phrase,
          headers: respHeaders,
          body: response.body,
        },
      },
    });
  }

  addTlsClientHello(
    clientIp: string,
    serverIp: string,
    clientMac: string,
    serverMac: string,
    clientPort: number,
    serverPort: number,
    sni: string,
    delta = 0.002,
  ) {
    this.packets.push({
      no: this.nextNo(),
      time: this.advanceTime(delta),
      length: 512,
      eth: { src: clientMac, dst: serverMac },
      ip: { src: clientIp, dst: serverIp, ttl: 64, version: 4 },
      tcp: {
        srcport: clientPort,
        dstport: serverPort,
        seq: 1,
        ack: 1,
        flags: { syn: false, ack: true, fin: false, rst: false, psh: true },
        payload: `TLSClientHello${sni}`,
      },
      tls: {
        handshake: "ClientHello",
        sni,
      },
    });
  }

  build(): Capture {
    if (this.packets.length > 3000) {
      throw new Error(`Capture exceeds 3,000 packet limit: ${this.packets.length}`);
    }
    return {
      name: this.name,
      packets: this.packets,
    };
  }
}

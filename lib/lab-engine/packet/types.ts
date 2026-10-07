export type Packet = {
  no: number;
  time: number /* s since start */;
  length: number;
  eth: { src: string; dst: string };
  arp?: { op: "request" | "reply"; senderIp: string; targetIp: string; senderMac: string };
  ip?: { src: string; dst: string; ttl: number; version: 4 | 6 };
  icmp?: { type: number; code: number };
  tcp?: {
    srcport: number;
    dstport: number;
    seq: number;
    ack: number;
    flags: { syn: boolean; ack: boolean; fin: boolean; rst: boolean; psh: boolean };
    payload?: string;
  };
  udp?: { srcport: number; dstport: number };
  dns?: {
    id: number;
    response: boolean;
    qname: string;
    qtype: string;
    rcode?: "NOERROR" | "NXDOMAIN";
    answers?: { name: string; type: string; data: string; ttl: number }[];
  };
  http?: {
    request?: { method: string; uri: string; host: string; headers: [string, string][]; body?: string };
    response?: { code: number; phrase: string; headers: [string, string][]; body?: string };
  };
  tls?: { handshake?: "ClientHello" | "ServerHello"; sni?: string; appData?: boolean };
};

export type Capture = { name: string; packets: Packet[] };

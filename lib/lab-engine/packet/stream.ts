import type { Packet } from "./types";

export type TcpStreamChunk = {
  sender: "client" | "server";
  text: string;
};

export type TcpStream = {
  client: string;
  server: string;
  text: string;
  chunks: TcpStreamChunk[];
};

/** Follows a TCP conversation (4-tuple) containing the given packet. */
export function followTcpStream(packets: Packet[], packetNo: number): TcpStream | null {
  const target = packets.find((p) => p.no === packetNo);
  if (!target || !target.tcp || !target.ip) return null;

  const ipA = target.ip.src;
  const portA = target.tcp.srcport;
  const ipB = target.ip.dst;
  const portB = target.tcp.dstport;

  const streamPackets = packets.filter((p) => {
    if (!p.tcp || !p.ip) return false;
    const isForward = p.ip.src === ipA && p.tcp.srcport === portA && p.ip.dst === ipB && p.tcp.dstport === portB;
    const isReverse = p.ip.src === ipB && p.tcp.srcport === portB && p.ip.dst === ipA && p.tcp.dstport === portA;
    return isForward || isReverse;
  });

  if (streamPackets.length === 0) return null;

  // Determine client: sender of SYN (without ACK), or sender of the first packet in the conversation
  const synPacket = streamPackets.find((p) => p.tcp?.flags.syn && !p.tcp?.flags.ack);
  let clientIp: string;
  let clientPort: number;
  let serverIp: string;
  let serverPort: number;

  if (synPacket && synPacket.ip && synPacket.tcp) {
    clientIp = synPacket.ip.src;
    clientPort = synPacket.tcp.srcport;
    serverIp = synPacket.ip.dst;
    serverPort = synPacket.tcp.dstport;
  } else {
    const first = streamPackets[0];
    clientIp = first.ip!.src;
    clientPort = first.tcp!.srcport;
    serverIp = first.ip!.dst;
    serverPort = first.tcp!.dstport;
  }

  const chunks: TcpStreamChunk[] = [];
  for (const p of streamPackets) {
    if (p.tcp?.payload) {
      const sender = p.ip?.src === clientIp && p.tcp.srcport === clientPort ? "client" : "server";
      chunks.push({ sender, text: p.tcp.payload });
    }
  }

  const text = chunks.map((c) => c.text).join("");

  return {
    client: `${clientIp}:${clientPort}`,
    server: `${serverIp}:${serverPort}`,
    text,
    chunks,
  };
}

"use client";

import type { Packet } from "@/lib/lab-engine/packet/types";

type Props = {
  packet: Packet | null;
  onFollowStream?: () => void;
};

export function PacketDetails({ packet, onFollowStream }: Props) {
  if (!packet) {
    return (
      <div className="border border-line bg-console p-4 font-mono text-sm text-muted">
        Select a packet to inspect protocol layers.
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-line bg-console p-4 text-ink">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h3 className="font-mono text-sm font-bold text-ink">Packet #{packet.no} Details</h3>
        {packet.tcp && onFollowStream && (
          <button
            type="button"
            onClick={onFollowStream}
            className="border border-cyan px-2 py-1 font-mono text-xs text-cyan hover:bg-cyan/10"
          >
            Follow TCP stream
          </button>
        )}
      </div>

      <div className="space-y-2 font-mono text-xs">
        {/* Frame / Ethernet */}
        <details open className="border border-line/60 bg-console-deep p-2">
          <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
            Ethernet II, Src: {packet.eth.src}, Dst: {packet.eth.dst}
          </summary>
          <div className="mt-2 space-y-1 pl-4 text-muted">
            <div>Destination: {packet.eth.dst}</div>
            <div>Source: {packet.eth.src}</div>
          </div>
        </details>

        {/* ARP */}
        {packet.arp && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Address Resolution Protocol ({packet.arp.op})
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              <div>Opcode: {packet.arp.op}</div>
              <div>Sender MAC: {packet.arp.senderMac}</div>
              <div>Sender IP: {packet.arp.senderIp}</div>
              <div>Target IP: {packet.arp.targetIp}</div>
            </div>
          </details>
        )}

        {/* IP */}
        {packet.ip && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Internet Protocol Version {packet.ip.version}, Src: {packet.ip.src}, Dst: {packet.ip.dst}
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              <div>Version: {packet.ip.version}</div>
              <div>Source Address: {packet.ip.src}</div>
              <div>Destination Address: {packet.ip.dst}</div>
              <div>Time to Live: {packet.ip.ttl}</div>
            </div>
          </details>
        )}

        {/* ICMP */}
        {packet.icmp && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Internet Control Message Protocol
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              <div>Type: {packet.icmp.type}</div>
              <div>Code: {packet.icmp.code}</div>
            </div>
          </details>
        )}

        {/* TCP */}
        {packet.tcp && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Transmission Control Protocol, Src Port: {packet.tcp.srcport}, Dst Port: {packet.tcp.dstport}
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              <div>Source Port: {packet.tcp.srcport}</div>
              <div>Destination Port: {packet.tcp.dstport}</div>
              <div>Sequence Number: {packet.tcp.seq}</div>
              <div>Acknowledgment Number: {packet.tcp.ack}</div>
              <div>
                Flags: SYN={packet.tcp.flags.syn ? 1 : 0}, ACK={packet.tcp.flags.ack ? 1 : 0}, FIN=
                {packet.tcp.flags.fin ? 1 : 0}, RST={packet.tcp.flags.rst ? 1 : 0}, PSH=
                {packet.tcp.flags.psh ? 1 : 0}
              </div>
            </div>
          </details>
        )}

        {/* UDP */}
        {packet.udp && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              User Datagram Protocol, Src Port: {packet.udp.srcport}, Dst Port: {packet.udp.dstport}
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              <div>Source Port: {packet.udp.srcport}</div>
              <div>Destination Port: {packet.udp.dstport}</div>
            </div>
          </details>
        )}

        {/* DNS */}
        {packet.dns && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Domain Name System ({packet.dns.response ? "response" : "query"})
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              <div>Transaction ID: 0x{packet.dns.id.toString(16).padStart(4, "0")}</div>
              <div>Query Name: {packet.dns.qname}</div>
              <div>Query Type: {packet.dns.qtype}</div>
              {packet.dns.rcode && <div>Reply Code: {packet.dns.rcode}</div>}
              {packet.dns.answers && packet.dns.answers.length > 0 && (
                <div className="mt-1">
                  Answers:
                  {packet.dns.answers.map((a, idx) => (
                    <div key={idx} className="pl-2">
                      {a.name}: type {a.type}, class IN, data {a.data}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}

        {/* HTTP */}
        {packet.http && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Hypertext Transfer Protocol
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              {packet.http.request && (
                <>
                  <div>Request Method: {packet.http.request.method}</div>
                  <div>Request URI: {packet.http.request.uri}</div>
                  <div>Request Host: {packet.http.request.host}</div>
                  {packet.http.request.headers.map(([k, v], idx) => (
                    <div key={idx}>
                      {k}: {v}
                    </div>
                  ))}
                  {packet.http.request.body && <div className="mt-1 text-ink">{packet.http.request.body}</div>}
                </>
              )}
              {packet.http.response && (
                <>
                  <div>Response Code: {packet.http.response.code}</div>
                  <div>Response Phrase: {packet.http.response.phrase}</div>
                  {packet.http.response.headers.map(([k, v], idx) => (
                    <div key={idx}>
                      {k}: {v}
                    </div>
                  ))}
                  {packet.http.response.body && <div className="mt-1 text-ink">{packet.http.response.body}</div>}
                </>
              )}
            </div>
          </details>
        )}

        {/* TLS */}
        {packet.tls && (
          <details open className="border border-line/60 bg-console-deep p-2">
            <summary className="cursor-pointer select-none font-semibold text-muted hover:text-ink">
              Transport Layer Security
            </summary>
            <div className="mt-2 space-y-1 pl-4 text-muted">
              {packet.tls.handshake && <div>Handshake Protocol: {packet.tls.handshake}</div>}
              {packet.tls.sni && <div>Server Name Indication extension: {packet.tls.sni}</div>}
              {packet.tls.appData && <div>Application Data Protocol: http-over-tls</div>}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

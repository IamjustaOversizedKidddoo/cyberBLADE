"use client";

import { useRef } from "react";
import type { Packet } from "@/lib/lab-engine/packet/types";
import { infoOf, protocolOf } from "@/lib/lab-engine/packet/summary";

type Props = {
  packets: Packet[];
  selectedPacket: Packet | null;
  onSelect: (packet: Packet) => void;
};

function protocolStyle(proto: string): string {
  switch (proto.toUpperCase()) {
    case "HTTP":
      return "text-success font-bold";
    case "TCP":
      return "text-sky-400 font-semibold";
    case "DNS":
      return "text-warning font-semibold";
    case "ARP":
      return "text-purple font-semibold";
    case "ICMP":
      return "text-danger font-semibold";
    case "TLS":
    case "SSL":
      return "text-cyan font-bold";
    default:
      return "text-ink font-medium";
  }
}

export function PacketTable({ packets, selectedPacket, onSelect }: Props) {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < packets.length - 1) {
        onSelect(packets[index + 1]);
        rowRefs.current[index + 1]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        onSelect(packets[index - 1]);
        rowRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(packets[index]);
    }
  };

  const getSource = (p: Packet): string => p.ip?.src ?? p.arp?.senderIp ?? p.eth.src;
  const getDestination = (p: Packet): string => p.ip?.dst ?? p.arp?.targetIp ?? p.eth.dst;

  return (
    <div className="w-full overflow-x-auto rounded-sm border border-line bg-console max-h-[380px] shadow-inner focus-within:ring-1 focus-within:ring-cyan">
      <table className="w-full text-left font-mono text-xs text-muted" role="table">
        <thead className="border-b border-line bg-surface-raised text-ink select-none sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 w-14">No.</th>
            <th className="px-3 py-2 w-28">Time</th>
            <th className="px-3 py-2 w-36">Source</th>
            <th className="px-3 py-2 w-36">Destination</th>
            <th className="px-3 py-2 w-20">Protocol</th>
            <th className="px-3 py-2 w-16">Length</th>
            <th className="px-3 py-2">Info</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/30">
          {packets.map((p, idx) => {
            const isSelected = selectedPacket?.no === p.no;
            const proto = protocolOf(p);
            return (
              <tr
                key={p.no}
                ref={(el) => {
                  rowRefs.current[idx] = el;
                }}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-cyan/20 text-cyan font-semibold border-l-2 border-l-cyan"
                    : "hover:bg-surface-hover hover:text-ink text-muted"
                }`}
              >
                <td className="px-3 py-1.5 font-mono">{p.no}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono">{p.time.toFixed(6)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono">{getSource(p)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono">{getDestination(p)}</td>
                <td className={`px-3 py-1.5 ${protocolStyle(proto)}`}>{proto}</td>
                <td className="px-3 py-1.5 font-mono">{p.length}</td>
                <td className="px-3 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-md font-mono">
                  {infoOf(p)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

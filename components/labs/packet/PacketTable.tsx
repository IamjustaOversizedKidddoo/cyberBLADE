"use client";

import { useRef } from "react";
import type { Packet } from "@/lib/lab-engine/packet/types";
import { infoOf, protocolOf } from "@/lib/lab-engine/packet/summary";

type Props = {
  packets: Packet[];
  selectedPacket: Packet | null;
  onSelect: (packet: Packet) => void;
};

export function PacketTable({ packets, selectedPacket, onSelect }: Props) {
  // No scroll-into-view effect: it would also scroll the page past the briefing on load and on
  // every filter. Arrow keys move focus, and focusing a row already brings it into view.
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
    <div className="w-full overflow-x-auto border border-line bg-[#05070a]">
      <table className="w-full text-left font-mono text-xs text-muted" role="table">
        <thead className="border-b border-line bg-[#0a0f18] text-ink select-none sticky top-0">
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
                className={`cursor-pointer transition-colors focus:outline-none ${
                  isSelected
                    ? "bg-[#00e5ff]/20 text-[#00e5ff] font-semibold"
                    : "hover:bg-line/40 hover:text-ink text-muted"
                }`}
              >
                <td className="px-3 py-1.5">{p.no}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{p.time.toFixed(6)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{getSource(p)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{getDestination(p)}</td>
                <td className="px-3 py-1.5 font-bold">{proto}</td>
                <td className="px-3 py-1.5">{p.length}</td>
                <td className="px-3 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-md">
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

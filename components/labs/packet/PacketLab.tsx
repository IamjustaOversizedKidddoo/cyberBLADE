"use client";

import { useState } from "react";
import type { Capture, Packet } from "@/lib/lab-engine/packet/types";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { followTcpStream, type TcpStream } from "@/lib/lab-engine/packet/stream";
import { PacketTable } from "./PacketTable";
import { PacketDetails } from "./PacketDetails";
import { StreamView } from "./StreamView";
import { Kbd } from "@/components/ui/Kbd";

type Props = {
  capture: Capture;
};

export function PacketLab({ capture }: Props) {
  const [filterInput, setFilterInput] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [activeFilterText, setActiveFilterText] = useState("");
  const [filteredPackets, setFilteredPackets] = useState<Packet[]>(capture.packets);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(capture.packets[0] ?? null);
  const [activeStream, setActiveStream] = useState<TcpStream | null>(null);

  const applyFilter = (filterText: string) => {
    const res = compileFilter(filterText);
    if (!res.ok) {
      setFilterError(res.error);
      return;
    }

    setFilterError(null);
    setActiveFilterText(filterText);
    const matched = capture.packets.filter(res.test);
    setFilteredPackets(matched);
    if (selectedPacket && !matched.some((p) => p.no === selectedPacket.no)) {
      setSelectedPacket(matched[0] ?? null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilter(filterInput);
    }
  };

  const handleFollowStream = () => {
    if (!selectedPacket?.tcp) return;
    const stream = followTcpStream(capture.packets, selectedPacket.no);
    if (stream) {
      setActiveStream(stream);
    }
  };

  if (activeStream) {
    return <StreamView stream={activeStream} onBack={() => setActiveStream(null)} />;
  }

  return (
    <div className="space-y-3.5">
      {/* Filter Bar with Tactical Chrome */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={filterInput}
              onChange={(e) => {
                setFilterInput(e.target.value);
                if (filterError) setFilterError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Apply a display filter (e.g. tcp.flags.syn == 1, ip.addr == 192.168.1.1)…"
              className={`w-full rounded-xs border bg-console px-3.5 py-2 font-mono text-xs text-ink placeholder:text-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${
                filterError
                  ? "border-danger focus-visible:ring-danger"
                  : "border-line focus:border-cyan"
              }`}
            />
            <div className="absolute right-2.5 top-2 hidden sm:flex items-center gap-1">
              <span className="text-[10px] font-ui text-muted/60">Press</span>
              <Kbd>Enter</Kbd>
            </div>
          </div>
          <button
            type="button"
            onClick={() => applyFilter(filterInput)}
            className="rounded-xs border border-cyan/60 bg-cyan/15 px-4 py-2 font-ui text-xs font-semibold text-cyan hover:bg-cyan hover:text-void transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            Apply
          </button>
        </div>
        {filterError && (
          <div role="alert" className="font-mono text-xs text-danger px-1">
            {filterError}
          </div>
        )}
      </div>

      {/* Protocol Legend & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2 font-mono text-xs text-muted">
        <div className="flex items-center gap-3">
          <span>
            Displayed: <strong className="text-ink">{filteredPackets.length}</strong> of {capture.packets.length} packets
          </span>
          {activeFilterText && (
            <span className="text-cyan font-semibold">Filter: &quot;{activeFilterText}&quot;</span>
          )}
        </div>

        {/* Protocol Legend */}
        <div className="flex flex-wrap items-center gap-2 font-ui text-[10px]">
          <span className="text-muted/60 uppercase">Protocols:</span>
          <span className="border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.2 rounded-xs text-sky-400">TCP</span>
          <span className="border border-success/40 bg-success/10 px-1.5 py-0.2 rounded-xs text-success">HTTP</span>
          <span className="border border-warning/40 bg-warning/10 px-1.5 py-0.2 rounded-xs text-warning">DNS</span>
          <span className="border border-purple/40 bg-purple/10 px-1.5 py-0.2 rounded-xs text-purple">ARP</span>
          <span className="border border-cyan/40 bg-cyan/10 px-1.5 py-0.2 rounded-xs text-cyan">TLS</span>
        </div>
      </div>

      {/* Packet Table */}
      <PacketTable
        packets={filteredPackets}
        selectedPacket={selectedPacket}
        onSelect={setSelectedPacket}
      />

      {/* Packet Details */}
      <PacketDetails packet={selectedPacket} onFollowStream={handleFollowStream} />
    </div>
  );
}

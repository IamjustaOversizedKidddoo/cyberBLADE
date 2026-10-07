"use client";

import { useState } from "react";
import type { Capture, Packet } from "@/lib/lab-engine/packet/types";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { followTcpStream, type TcpStream } from "@/lib/lab-engine/packet/stream";
import { PacketTable } from "./PacketTable";
import { PacketDetails } from "./PacketDetails";
import { StreamView } from "./StreamView";

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
      // Keeps the last good list of filtered packets
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
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="space-y-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={filterInput}
            onChange={(e) => {
              setFilterInput(e.target.value);
              if (filterError) setFilterError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Apply a display filter…"
            className={`flex-1 border bg-[#05070a] px-3 py-2 font-mono text-sm text-ink placeholder-muted/60 focus:outline-none ${
              filterError
                ? "border-[#ff007f] focus:border-[#ff007f]"
                : "border-line focus:border-[#00e5ff]"
            }`}
          />
          <button
            type="button"
            onClick={() => applyFilter(filterInput)}
            className="border border-line bg-[#0a0f18] px-4 py-2 font-mono text-sm text-ink hover:border-ink hover:text-white"
          >
            Apply
          </button>
        </div>
        {filterError && (
          <div role="alert" className="font-mono text-xs text-[#ff007f]">
            {filterError}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>
          Displayed: {filteredPackets.length} of {capture.packets.length} packets
        </span>
        {activeFilterText && <span>Filter: &quot;{activeFilterText}&quot;</span>}
      </div>

      {/* Packet Table */}
      <div className="max-h-[360px] overflow-auto border border-line">
        <PacketTable
          packets={filteredPackets}
          selectedPacket={selectedPacket}
          onSelect={setSelectedPacket}
        />
      </div>

      {/* Packet Details */}
      <PacketDetails packet={selectedPacket} onFollowStream={handleFollowStream} />
    </div>
  );
}

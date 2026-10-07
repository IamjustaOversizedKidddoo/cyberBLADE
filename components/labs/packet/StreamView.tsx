"use client";

import type { TcpStream } from "@/lib/lab-engine/packet/stream";

type Props = {
  stream: TcpStream;
  onBack: () => void;
};

export function StreamView({ stream, onBack }: Props) {
  return (
    <div className="space-y-4 border border-line bg-[#05070a] p-4 text-ink">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="space-x-4 font-mono text-sm">
          <span>
            Client: <span className="text-[#00e5ff]">{stream.client}</span>
          </span>
          <span>
            Server: <span className="text-[#ff007f]">{stream.server}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="border border-line px-3 py-1 font-mono text-xs text-muted hover:border-ink hover:text-ink"
        >
          Back to packets
        </button>
      </div>

      <div className="max-h-[500px] overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed p-2 bg-[#020408]">
        {stream.chunks.map((chunk, idx) => (
          <span
            key={idx}
            className={chunk.sender === "client" ? "text-[#00e5ff]" : "text-[#ff007f]"}
          >
            {chunk.text}
          </span>
        ))}
      </div>
    </div>
  );
}

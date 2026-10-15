"use client";

import { useState } from "react";
import type { PcapFlowsResult, EntityType, FlowRecord } from "@/lib/lab-engine/soc/enrichment/types";
import { Badge } from "@/components/ui/Badge";
import { PacketTable } from "@/components/labs/packet/PacketTable";
import { PacketDetails } from "@/components/labs/packet/PacketDetails";
import type { Packet } from "@/lib/lab-engine/packet/types";
import { IconDownload, IconLayers, IconActivity } from "@/components/ui/icons";
import { csvCell } from "@/lib/security/csv";

type Props = {
  data: PcapFlowsResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

const escapeCsvCell = csvCell;

export function PcapFlowEvidencePanel({ data, onPivot, onAttachEvidence }: Props) {
  const [activeTab, setActiveTab] = useState<"flows" | "periodicity" | "packets">("flows");
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(
    data.packets && data.packets.length > 0 ? (data.packets[0] as unknown as Packet) : null,
  );
  const [exported, setExported] = useState(false);

  const handleExportCsv = () => {
    const headers = ["Flow ID", "Timestamp", "Protocol", "Source IP", "Source Port", "Dest IP", "Dest Port", "Packets", "Bytes Sent", "Bytes Received", "Duration (ms)"];
    const rows = data.flows.map((f: FlowRecord) => [
      escapeCsvCell(f.id),
      escapeCsvCell(f.timestamp),
      escapeCsvCell(f.protocol),
      escapeCsvCell(f.srcIp),
      escapeCsvCell(f.srcPort),
      escapeCsvCell(f.dstIp),
      escapeCsvCell(f.dstPort),
      escapeCsvCell(f.packets),
      escapeCsvCell(f.bytesSent),
      escapeCsvCell(f.bytesReceived),
      escapeCsvCell(f.durationMs),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `network_flows_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const period = data.analytics.periodicity;
  const talkers = data.analytics.topTalkers;

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Network Flows & Packet Capture Evidence</span>
          <div className="text-ink font-bold text-sm truncate max-w-md">
            {data.totalFlows} Synthesized Flow Sessions
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-2 py-1 text-[11px] text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            title="Export flows as CSV"
          >
            <IconDownload className="h-3 w-3" />
            {exported ? "Downloaded" : "Export CSV"}
          </button>

          {onAttachEvidence && (
            <button
              type="button"
              onClick={() =>
                onAttachEvidence(
                  `Network flows: ${data.flows.length} sessions, periodicity=${period.detected ? "detected" : "none"}`,
                )
              }
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab("flows")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "flows" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Flow Records ({data.flows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("periodicity")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "periodicity" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Periodicity & Top Talkers
        </button>
        {data.packets && data.packets.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("packets")}
            className={`pb-2 px-2.5 font-bold border-b-2 ${
              activeTab === "packets" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Packet Capture ({data.packets.length})
          </button>
        )}
      </div>

      {/* Tab 1: Flow Records Table */}
      {activeTab === "flows" && (
        <div className="space-y-2">
          {data.flows.length === 0 ? (
            <div className="text-[11px] text-muted italic p-4 text-center">No network flow records captured.</div>
          ) : (
            <div className="overflow-x-auto rounded-xs border border-line bg-console max-h-96">
              <table className="w-full text-left border-collapse" role="table" aria-label="Network flow records">
                <thead>
                  <tr className="border-b border-line bg-surface text-[10px] text-muted uppercase tracking-wider sticky top-0">
                    <th className="p-2">Timestamp</th>
                    <th className="p-2">Proto</th>
                    <th className="p-2">Source</th>
                    <th className="p-2">Destination</th>
                    <th className="p-2 text-right">Packets</th>
                    <th className="p-2 text-right">Sent / Recv</th>
                    <th className="p-2 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/30 text-[11px]">
                  {data.flows.map((flow: FlowRecord) => (
                    <tr key={flow.id} className="hover:bg-surface-hover/50 font-mono">
                      <td className="p-2 text-muted text-[10px]">
                        {new Date(flow.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="p-2 font-bold text-ink">
                        <Badge variant="outline" size="sm">{flow.protocol}</Badge>
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => onPivot("ip", flow.srcIp)}
                          className="text-cyan hover:underline select-all"
                        >
                          {flow.srcIp}:{flow.srcPort}
                        </button>
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => onPivot("ip", flow.dstIp)}
                          className="text-cyan hover:underline select-all"
                        >
                          {flow.dstIp}:{flow.dstPort}
                        </button>
                      </td>
                      <td className="p-2 text-right text-secondary">{flow.packets}</td>
                      <td className="p-2 text-right text-ink font-semibold">
                        {flow.bytesSent.toLocaleString()} / {flow.bytesReceived.toLocaleString()}
                      </td>
                      <td className="p-2 text-right text-muted">{flow.durationMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Periodicity & Beaconing Analytics */}
      {activeTab === "periodicity" && (
        <div className="space-y-4">
          {/* Periodicity Card */}
          <div className="rounded-xs border border-line bg-surface p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <IconActivity className="h-3.5 w-3.5 text-cyan" />
                Inter-Arrival Time (IAT) & Beaconing Analysis
              </span>
              <Badge variant={period.detected ? "danger" : "emerald"} size="sm">
                {period.detected ? "PERIODIC PATTERN DETECTED" : "APERIODIC / AMBIENT"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-muted">Mean Interval:</span>
                <div className="text-ink font-bold">{period.intervalSeconds ?? 0}s</div>
              </div>
              <div>
                <span className="text-muted">Confidence:</span>
                <div className="text-ink font-bold">{period.confidence ?? 0}%</div>
              </div>
              <div>
                <span className="text-muted">Detected Pattern:</span>
                <div className="text-ink font-bold">{period.detected ? "C2 Callback Polling" : "None"}</div>
              </div>
            </div>

            {/* Accessible Text Alternative for Periodicity Pattern */}
            <div
              tabIndex={0}
              aria-label="Accessible text explanation of periodicity analysis"
              className="bg-console p-2.5 rounded-xs border border-line text-[11px] text-secondary leading-relaxed"
            >
              <strong>Statistical Summary:</strong> {period.summary}
            </div>
          </div>

          {/* Top Talkers Card */}
          <div className="rounded-xs border border-line bg-surface p-3 space-y-2">
            <span className="font-bold text-ink flex items-center gap-1.5 border-b border-line/40 pb-2">
              <IconLayers className="h-3.5 w-3.5 text-cyan" />
              Top Talkers & Connection Frequency
            </span>

            <div className="space-y-1.5">
              {talkers.map((t: { ip: string; bytes: number }, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-[11px] bg-console p-2 rounded-xs border border-line/40">
                  <div className="flex items-center gap-2">
                    <span className="text-muted font-bold">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onPivot("ip", t.ip)}
                      className="text-cyan hover:underline font-mono"
                    >
                      {t.ip}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-ink">{t.bytes.toLocaleString()} bytes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Reused Packet Table & Hex Details */}
      {activeTab === "packets" && data.packets && (
        <div className="space-y-3">
          <div className="h-56 border border-line rounded-xs overflow-hidden">
            <PacketTable
              packets={data.packets as unknown as Packet[]}
              selectedPacket={selectedPacket}
              onSelect={(p: Packet) => setSelectedPacket(p)}
            />
          </div>

          {selectedPacket && (
            <div className="border border-line rounded-xs overflow-hidden">
              <PacketDetails packet={selectedPacket} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

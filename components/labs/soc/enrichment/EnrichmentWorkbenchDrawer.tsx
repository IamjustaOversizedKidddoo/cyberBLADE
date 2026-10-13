"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  EnrichmentTool,
  EntityType,
  EnrichmentLookupResponse,
  ReputationResult,
  WhoisResult,
  PdnsResult,
  EmailHeaderAnalysisResult,
  UrlAnalysisResult,
  SandboxReportResult,
  PcapFlowsResult,
  EndpointTimelineResult,
  CmdbResult,
  TicketHistoryResult,
} from "@/lib/lab-engine/soc/enrichment/types";
import { ENRICHMENT_TOOLS } from "@/lib/lab-engine/soc/enrichment/types";
import { detectEntityType, defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { lookupSocEnrichmentAction } from "@/app/(app)/labs/soc/actions";
import { Badge } from "@/components/ui/Badge";
import {
  IconSearch,
  IconClose,
  IconClock,
  IconShield,
  IconGlobe,
  IconMail,
  IconFile,
  IconActivity,
  IconTerminal,
  IconLayers,
} from "@/components/ui/icons";

// Tool components
import { IndicatorReputationPanel } from "./IndicatorReputationPanel";
import { WhoisRecordPanel } from "./WhoisRecordPanel";
import { PdnsResolutionPanel } from "./PdnsResolutionPanel";
import { EmailHeaderAnalyzerPanel } from "./EmailHeaderAnalyzerPanel";
import { UrlAnalysisPanel } from "./UrlAnalysisPanel";
import { SandboxReportPanel } from "./SandboxReportPanel";
import { PcapFlowEvidencePanel } from "./PcapFlowEvidencePanel";
import { EndpointTimelinePanel } from "./EndpointTimelinePanel";
import { CmdbDirectoryPanel } from "./CmdbDirectoryPanel";
import { ServiceTicketsPanel } from "./ServiceTicketsPanel";

export interface InvestigationTarget {
  tool: EnrichmentTool;
  entityType: EntityType;
  entityValue: string;
}

type Props = {
  attemptId: string;
  isOpen: boolean;
  initialTarget?: InvestigationTarget | null;
  onClose: () => void;
  onAttachEvidenceToCase?: (evidenceSummary: string) => void;
};

interface HistoryItem {
  tool: EnrichmentTool;
  entityType: EntityType;
  entityValue: string;
  timestamp: string;
  response: EnrichmentLookupResponse;
}

export function EnrichmentWorkbenchDrawer({
  attemptId,
  isOpen,
  initialTarget,
  onClose,
  onAttachEvidenceToCase,
}: Props) {
  const [selectedTool, setSelectedTool] = useState<EnrichmentTool>(initialTarget?.tool ?? "reputation");
  const [searchQuery, setSearchQuery] = useState<string>(initialTarget?.entityValue ?? "");
  const [detectedType, setDetectedType] = useState<EntityType>(initialTarget?.entityType ?? "ip");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeResponse, setActiveResponse] = useState<EnrichmentLookupResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect entity type when typing
  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    const detected = detectEntityType(val);
    if (detected) {
      setDetectedType(detected);
    }
  };

  // Perform lookup
  const executeLookup = useCallback(
    async (tool: EnrichmentTool, type: EntityType, value: string) => {
      const cleanVal = value.trim();
      if (!cleanVal) return;

      setIsLoading(true);
      setErrorMessage(null);
      setStatusAnnouncement(`Querying simulated ${tool} for ${defangIndicator(cleanVal)}...`);

      try {
        const res = await lookupSocEnrichmentAction({
          attemptId,
          tool,
          entityType: type,
          entityValue: cleanVal,
        });

        setActiveResponse(res);
        setStatusAnnouncement(`Lookup complete for ${defangIndicator(cleanVal)}.`);

        setHistory((prev) => {
          const filtered = prev.filter(
            (h) => !(h.tool === tool && h.entityValue.toLowerCase() === cleanVal.toLowerCase()),
          );
          return [
            {
              tool,
              entityType: type,
              entityValue: cleanVal,
              timestamp: new Date().toISOString(),
              response: res,
            },
            ...filtered,
          ].slice(0, 15);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Lookup failed. Please verify indicator.";
        setErrorMessage(msg);
        setStatusAnnouncement(`Error: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [attemptId],
  );

  // Sync initial target when opened with specific entity
  useEffect(() => {
    if (initialTarget && isOpen) {
      const target = initialTarget;
      const timer = setTimeout(() => {
        setSelectedTool(target.tool);
        setSearchQuery(target.entityValue);
        setDetectedType(target.entityType);
        void executeLookup(target.tool, target.entityType, target.entityValue);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialTarget, isOpen, executeLookup]);

  // Handle cross-tool pivot
  const handlePivot = useCallback(
    (pivotType: EntityType, pivotValue: string) => {
      setSearchQuery(pivotValue);
      setDetectedType(pivotType);

      // Select most appropriate default tool for the pivot entity type
      let nextTool: EnrichmentTool = "reputation";
      if (pivotType === "domain") nextTool = "pdns";
      else if (pivotType === "hash") nextTool = "sandbox";
      else if (pivotType === "url") nextTool = "url_analysis";
      else if (pivotType === "host") nextTool = "endpoint_timeline";
      else if (pivotType === "user") nextTool = "cmdb";

      setSelectedTool(nextTool);
      executeLookup(nextTool, pivotType, pivotValue);
    },
    [executeLookup],
  );

  // Focus input on drawer open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toolLabels: Record<EnrichmentTool, { name: string; icon: React.ReactNode }> = {
    reputation: { name: "Reputation", icon: <IconShield className="h-3.5 w-3.5" /> },
    whois: { name: "WHOIS", icon: <IconGlobe className="h-3.5 w-3.5" /> },
    pdns: { name: "pDNS", icon: <IconLayers className="h-3.5 w-3.5" /> },
    email_headers: { name: "Email Forensics", icon: <IconMail className="h-3.5 w-3.5" /> },
    url_analysis: { name: "URL Analyzer", icon: <IconGlobe className="h-3.5 w-3.5" /> },
    sandbox: { name: "Sandbox", icon: <IconFile className="h-3.5 w-3.5" /> },
    pcap_flows: { name: "PCAP / Flows", icon: <IconActivity className="h-3.5 w-3.5" /> },
    endpoint_timeline: { name: "Endpoint EDR", icon: <IconTerminal className="h-3.5 w-3.5" /> },
    cmdb: { name: "CMDB / IdP", icon: <IconShield className="h-3.5 w-3.5" /> },
    tickets: { name: "Tickets", icon: <IconClock className="h-3.5 w-3.5" /> },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simulated Investigation Workbench"
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity"
    >
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      {/* Main Drawer Container */}
      <div className="w-full sm:w-[90%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-full bg-console border-l border-line flex flex-col shadow-2xl font-mono text-xs">
        {/* Drawer Header */}
        <div className="p-3 border-b border-line bg-surface flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconShield className="h-4 w-4 text-cyan" />
            <span className="font-bold text-ink text-sm">Tier-1 Investigation Workbench</span>
            <Badge variant="cyan" size="sm">SIMULATED INTEL</Badge>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xs border border-line bg-surface p-1.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Close investigation drawer"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* Global Query Search Bar */}
        <div className="p-3 border-b border-line bg-console space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeLookup(selectedTool, detectedType, searchQuery);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Enter IP, domain, URL, hash, email, user, or host..."
                className="w-full rounded-xs border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              />
              {detectedType && (
                <div className="absolute right-2 top-2">
                  <Badge variant="outline" size="sm" className="uppercase font-bold">
                    {detectedType}
                  </Badge>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded-xs bg-cyan px-4 py-2 font-bold text-black hover:bg-cyan/90 disabled:opacity-50 min-h-[36px]"
            >
              <IconSearch className="h-3.5 w-3.5" />
              <span>{isLoading ? "Querying..." : "Investigate"}</span>
            </button>
          </form>

          {/* Tool Picker Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-thin">
            {ENRICHMENT_TOOLS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setSelectedTool(t);
                  if (searchQuery.trim()) {
                    executeLookup(t, detectedType, searchQuery);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold whitespace-nowrap text-[11px] ${
                  selectedTool === t
                    ? "bg-cyan/20 text-cyan border border-cyan/40"
                    : "text-muted hover:text-ink hover:bg-surface"
                }`}
              >
                {toolLabels[t].icon}
                <span>{toolLabels[t].name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center space-y-3">
              <div className="inline-block animate-spin h-6 w-6 border-2 border-cyan border-t-transparent rounded-full" />
              <div className="text-secondary text-xs">Simulating authoritative intelligence lookup...</div>
              <div className="text-muted text-[10px]">Zero real-world network requests executed.</div>
            </div>
          ) : errorMessage ? (
            <div className="p-6 text-center space-y-3">
              <div className="rounded-xs border border-danger/40 bg-danger/10 p-4 text-danger max-w-md mx-auto">
                <div className="font-bold text-sm mb-1">Investigation Query Error</div>
                <p className="text-xs">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => executeLookup(selectedTool, detectedType, searchQuery)}
                className="text-xs text-cyan hover:underline font-bold"
              >
                Retry Lookup
              </button>
            </div>
          ) : activeResponse ? (
            <div>
              {selectedTool === "reputation" && (
                <IndicatorReputationPanel
                  data={activeResponse.payload as ReputationResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "whois" && (
                <WhoisRecordPanel
                  data={activeResponse.payload as WhoisResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "pdns" && (
                <PdnsResolutionPanel
                  data={activeResponse.payload as PdnsResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "email_headers" && (
                <EmailHeaderAnalyzerPanel
                  data={activeResponse.payload as EmailHeaderAnalysisResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "url_analysis" && (
                <UrlAnalysisPanel
                  data={activeResponse.payload as UrlAnalysisResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "sandbox" && (
                <SandboxReportPanel
                  data={activeResponse.payload as SandboxReportResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "pcap_flows" && (
                <PcapFlowEvidencePanel
                  data={activeResponse.payload as PcapFlowsResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "endpoint_timeline" && (
                <EndpointTimelinePanel
                  data={activeResponse.payload as EndpointTimelineResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "cmdb" && (
                <CmdbDirectoryPanel
                  data={activeResponse.payload as CmdbResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
              {selectedTool === "tickets" && (
                <ServiceTicketsPanel
                  data={activeResponse.payload as TicketHistoryResult}
                  onPivot={handlePivot}
                  onAttachEvidence={onAttachEvidenceToCase}
                />
              )}
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <IconSearch className="h-8 w-8 text-muted mx-auto" />
              <h4 className="text-sm font-bold text-ink">Simulated Investigation Tools</h4>
              <p className="text-secondary max-w-sm mx-auto leading-relaxed">
                Enter an indicator above or click any entity in the alert telemetry to open WHOIS records, reputation reports, email headers, PCAP flows, EDR timelines, or CMDB assets.
              </p>
            </div>
          )}
        </div>

        {/* Recent Lookups History Drawer Footer */}
        {history.length > 0 && (
          <div className="p-2 border-t border-line bg-surface flex items-center gap-2 overflow-x-auto text-[10px]">
            <span className="text-muted font-bold shrink-0 uppercase">Recent:</span>
            {history.map((h, idx) => (
              <button
                key={`${h.tool}-${h.entityValue}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedTool(h.tool);
                  setSearchQuery(h.entityValue);
                  setDetectedType(h.entityType);
                  setActiveResponse(h.response);
                }}
                className="rounded-xs border border-line bg-console px-2 py-0.5 text-secondary hover:text-ink hover:border-cyan/40 shrink-0 font-mono truncate max-w-[140px]"
                title={`${h.tool}: ${h.entityValue}`}
              >
                {h.tool}: {defangIndicator(h.entityValue)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

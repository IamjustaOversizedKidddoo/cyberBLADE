"use client";

import { useState } from "react";
import type {
  EmailHeaderAnalysisResult,
  EntityType,
  EmailReceivedHop,
  EmailBodyLink,
  EmailAttachmentDescriptor,
  EmailHeaderMismatch,
  EmailAuthStatus,
} from "@/lib/lab-engine/soc/enrichment/types";
import { defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconMail,
  IconPaperclip,
} from "@/components/ui/icons";

type Props = {
  data: EmailHeaderAnalysisResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function EmailHeaderAnalyzerPanel({ data, onPivot, onAttachEvidence }: Props) {
  const [activeTab, setActiveTab] = useState<"structure" | "hops" | "links_attachments" | "raw">("structure");
  const [copied, setCopied] = useState(false);

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(data.rawHeaders);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDefanged = (val: string) => {
    navigator.clipboard.writeText(defangIndicator(val));
  };

  const auth = data.authentication;
  const p = data.parsedHeaders;

  const authBadge = (status: EmailAuthStatus) => {
    let variant: BadgeVariant = "outline";
    if (status === "pass") variant = "emerald";
    else if (status === "fail") variant = "danger";
    else if (status === "softfail" || status === "neutral") variant = "amber";

    return (
      <Badge variant={variant} size="sm">
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Email Security & Header Forensics</span>
          <div className="text-ink font-bold text-sm truncate max-w-md">
            {p.subject || "Security Alert Notification"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() =>
                onAttachEvidence(
                  `Email analysis: From=${p.from}, Return-Path=${p.returnPath}, SPF=${auth.spf.status}, DMARC=${auth.dmarc.status}`,
                )
              }
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Header Mismatches Prompts */}
      {data.mismatches.length > 0 && (
        <div className="space-y-1.5">
          {data.mismatches.map((m: EmailHeaderMismatch, idx: number) => (
            <div key={idx} className="rounded-xs border border-amber/40 bg-amber/10 p-2.5 space-y-1">
              <div className="flex items-center gap-2 text-amber font-bold">
                <IconAlertTriangle className="h-4 w-4 shrink-0" />
                <span>Worth Checking: {m.issue}</span>
              </div>
              <p className="text-secondary text-[11px] leading-relaxed">
                {m.explanation}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-view navigation tabs */}
      <div className="flex border-b border-line gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab("structure")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "structure" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Authentication & Headers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hops")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "hops" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Received Hop Chain ({data.receivedHops.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("links_attachments")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "links_attachments" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Links & Attachments ({data.bodyLinks.length + data.attachments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("raw")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "raw" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Raw RFC 822 Headers
        </button>
      </div>

      {/* Tab 1: Structure & Auth */}
      {activeTab === "structure" && (
        <div className="space-y-3">
          {/* Authentication Results Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xs border border-line bg-surface p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">SPF</span>
                {authBadge(auth.spf.status)}
              </div>
              <div className="text-[10px] text-muted truncate">Domain: {auth.spf.domain}</div>
              <p className="text-[10px] text-secondary leading-snug border-t border-line/40 pt-1">
                {auth.spf.explanation}
              </p>
            </div>

            <div className="rounded-xs border border-line bg-surface p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">DKIM</span>
                {authBadge(auth.dkim.status)}
              </div>
              <div className="text-[10px] text-muted truncate">Domain: {auth.dkim.domain}</div>
              <p className="text-[10px] text-secondary leading-snug border-t border-line/40 pt-1">
                {auth.dkim.explanation}
              </p>
            </div>

            <div className="rounded-xs border border-line bg-surface p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">DMARC</span>
                {authBadge(auth.dmarc.status)}
              </div>
              <div className="text-[10px] text-muted truncate">Policy: {auth.dmarc.policy}</div>
              <p className="text-[10px] text-secondary leading-snug border-t border-line/40 pt-1">
                {auth.dmarc.explanation}
              </p>
            </div>
          </div>

          {/* Address Comparison Table */}
          <div className="rounded-xs border border-line bg-surface p-3 space-y-2">
            <span className="font-bold text-ink flex items-center gap-1.5 border-b border-line/40 pb-2">
              <IconMail className="h-3.5 w-3.5 text-cyan" />
              Header vs Envelope Address Comparison
            </span>

            <div className="space-y-2 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-muted w-28 shrink-0">From (Display):</span>
                <span className="text-ink font-semibold truncate select-all">{p.from}</span>
                <button
                  type="button"
                  onClick={() => onPivot("domain", p.fromDomain)}
                  className="text-[10px] text-cyan hover:underline shrink-0"
                >
                  Pivot domain ({defangIndicator(p.fromDomain)})
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-muted w-28 shrink-0">Return-Path:</span>
                <span className="text-ink font-semibold truncate select-all">{p.returnPath}</span>
                <button
                  type="button"
                  onClick={() => onPivot("domain", p.returnPathDomain)}
                  className="text-[10px] text-cyan hover:underline shrink-0"
                >
                  Pivot domain ({defangIndicator(p.returnPathDomain)})
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-muted w-28 shrink-0">Reply-To:</span>
                <span className="text-ink font-semibold truncate select-all">
                  {p.replyTo ? p.replyTo : "Not explicitly declared"}
                </span>
              </div>
            </div>
          </div>

          {/* Key Message Metadata */}
          <div className="rounded-xs border border-line bg-surface p-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted">Message-ID:</span>
              <span className="text-ink font-mono select-all truncate max-w-xs">{p.messageId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Origination Date:</span>
              <span className="text-ink">{new Date(p.date).toUTCString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Hop Chain */}
      {activeTab === "hops" && (
        <div className="space-y-3">
          <div className="text-[11px] text-muted">
            Chronological relay delivery path from originating server to gateway.
          </div>

          <div className="space-y-2">
            {data.receivedHops.map((hop: EmailReceivedHop) => (
              <div
                key={hop.hopNumber}
                className="rounded-xs border border-line bg-surface p-3 space-y-2"
              >
                <div className="flex items-center justify-between border-b border-line/40 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-cyan/20 text-cyan px-2 py-0.5 font-bold text-[10px]">
                      Hop #{hop.hopNumber}
                    </span>
                    <span className="font-semibold text-ink">{hop.byHost}</span>
                  </div>
                  {hop.delaySeconds !== undefined && (
                    <span className="text-[10px] text-muted">
                      Delay: <strong className="text-ink">+{hop.delaySeconds}s</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted text-[10px]">Received From:</span>
                    <div className="text-ink font-mono">{hop.fromHost}</div>
                  </div>
                  <div>
                    <span className="text-muted text-[10px]">Relay Client IP:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink font-mono">{hop.clientIp}</span>
                      <button
                        type="button"
                        onClick={() => onPivot("ip", hop.clientIp)}
                        className="text-[10px] text-cyan hover:underline"
                      >
                        [Pivot IP]
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted text-[10px]">Timestamp:</span>
                    <div className="text-secondary text-[10px]">{new Date(hop.timestamp).toISOString()}</div>
                  </div>
                  <div>
                    <span className="text-muted text-[10px]">Reverse DNS Validated:</span>
                    <div className="text-ink">{hop.rDnsMatch ? "Verified PTR" : "Unverified"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Links and Attachments */}
      {activeTab === "links_attachments" && (
        <div className="space-y-4">
          {/* Extracted Links */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
              Embedded Message Links ({data.bodyLinks.length})
            </h4>

            {data.bodyLinks.length === 0 ? (
              <div className="text-[11px] text-muted italic">No hyperlinks detected in message body.</div>
            ) : (
              <div className="space-y-2">
                {data.bodyLinks.map((link: EmailBodyLink, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xs border border-line bg-surface p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{link.visibleText}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyDefanged(link.actualUrl)}
                        className="text-[10px] text-cyan hover:underline"
                      >
                        Copy Defanged URL
                      </button>
                    </div>

                    <div className="text-[11px] font-mono text-secondary truncate select-all">
                      Target: {link.defangedUrl}
                    </div>

                    <div className="flex items-center justify-between border-t border-line/40 pt-1.5">
                      <button
                        type="button"
                        onClick={() => onPivot("url", link.actualUrl)}
                        className="text-[10px] text-cyan font-bold hover:underline"
                      >
                        Inspect URL in URL Analyzer →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2 border-t border-line pt-3">
            <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
              Attachments ({data.attachments.length})
            </h4>

            {data.attachments.length === 0 ? (
              <div className="text-[11px] text-muted italic">No attachments attached to this message.</div>
            ) : (
              <div className="space-y-2">
                {data.attachments.map((att: EmailAttachmentDescriptor, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xs border border-line bg-surface p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink flex items-center gap-1.5">
                        <IconPaperclip className="h-3.5 w-3.5 text-cyan" />
                        {att.filename}
                      </span>
                      <span className="text-[10px] text-muted">
                        {(att.sizeBytes / 1024).toFixed(1)} KB • {att.mimeType}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-secondary select-all truncate">
                      SHA256: {att.hashSha256}
                    </div>

                    <div className="flex justify-end border-t border-line/40 pt-1.5">
                      <button
                        type="button"
                        onClick={() => onPivot("hash", att.hashSha256)}
                        className="text-[10px] text-cyan font-bold hover:underline"
                      >
                        Inspect in Sandbox Report →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Raw RFC 822 Headers */}
      {activeTab === "raw" && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted">Complete unedited RFC 822 Internet Message Headers</span>
            <button
              type="button"
              onClick={handleCopyRaw}
              className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-2 py-0.5 text-[10px] text-muted hover:text-ink"
            >
              {copied ? <IconCheck className="h-3 w-3 text-emerald-400" /> : <IconCopy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy Raw Headers"}
            </button>
          </div>

          <pre
            tabIndex={0}
            aria-label="Raw email headers"
            className="p-3 rounded-xs border border-line bg-console text-[10px] text-secondary font-mono overflow-x-auto max-h-96 select-all focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            {data.rawHeaders}
          </pre>
        </div>
      )}
    </div>
  );
}

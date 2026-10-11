"use client";

import { useEffect, useState } from "react";
import type { CertReadiness, GradingBand } from "@/lib/readiness/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

function bandClass(band: GradingBand): string {
  switch (band) {
    case "Exam Ready":
      return "border-cyan bg-cyan/15 text-cyan shadow-[0_0_8px_rgba(15,190,255,0.25)]";
    case "Strong":
      return "border-cyan/60 bg-cyan/10 text-cyan";
    case "Good":
      return "border-purple bg-purple/15 text-purple";
    case "Needs review":
      return "border-warning bg-warning/15 text-warning";
    case "Weak":
    default:
      return "border-line bg-void text-muted";
  }
}

export function CertReadinessSection({ readiness }: { readiness: CertReadiness[] }) {
  const [expandedCert, setExpandedCert] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedCert(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section aria-labelledby="readiness-heading" className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 id="readiness-heading" className="font-display text-3xl text-ink">
            certification_readiness
          </h2>
          <p className="font-ui text-xs tracking-wider text-muted mt-1">
            OBJECTIVE MASTERY MATRIX AGAINST INDUSTRY EXAM TARGETS
          </p>
        </div>
        <span className="font-ui text-xs text-cyan border border-cyan/40 px-3 py-1 font-mono">
          {readiness.length} CERTIFICATIONS TRACKED
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {readiness.map((cert) => {
          const isExpanded = expandedCert === cert.certId;
          const barVariant =
            cert.scorePercent >= 80 ? "cyan" : cert.scorePercent >= 50 ? "purple" : "amber";

          return (
            <div
              key={cert.certId}
              className={`border p-5 transition-all rounded-xs ${
                isExpanded
                  ? "border-cyan bg-surface-raised shadow-[0_0_15px_rgba(15,190,255,0.08)]"
                  : "border-line bg-console hover:border-line/80"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-ui text-base font-bold text-ink leading-tight">
                    {cert.name}
                  </h3>
                  <span className="font-mono text-xs text-muted/70 tracking-wider">
                    EXAM: {cert.examCode}
                  </span>
                </div>
                <span
                  className={`border px-2 py-0.5 font-ui text-[11px] font-bold tracking-widest uppercase rounded-xs ${bandClass(
                    cert.band,
                  )}`}
                >
                  {cert.band}
                </span>
              </div>

              {/* Score bar */}
              <div className="my-4">
                <div className="flex justify-between items-baseline font-ui text-xs text-muted mb-1.5">
                  <span>MASTERY</span>
                  <span className="text-ink font-bold font-mono">{cert.scorePercent}%</span>
                </div>
                <ProgressBar
                  value={cert.scorePercent}
                  variant={barVariant}
                  size="sm"
                  aria-label={`${cert.name} readiness: ${cert.scorePercent}%`}
                />
              </div>

              {/* Progress counter & expand toggle */}
              <div className="flex items-center justify-between border-t border-line/60 pt-3">
                <span className="font-ui text-xs text-muted">
                  <strong className="text-ink font-mono">{cert.completedObjectives}</strong> /{" "}
                  {cert.totalObjectives} Objectives
                </span>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedCert(isExpanded ? null : cert.certId)}
                  className="font-ui text-xs text-cyan hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan rounded-xs px-1 py-0.5"
                >
                  {isExpanded ? "[Hide details]" : "[View matrix]"}
                </button>
              </div>

              {/* Expanded Objectives Breakdown */}
              {isExpanded && (
                <div className="mt-4 border-t border-line/60 pt-3 space-y-2.5 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="font-ui text-[11px] tracking-wider text-muted uppercase font-semibold">
                      Objective Audit Breakdown:
                    </p>
                    <span className="text-[10px] font-mono text-muted/60">Press Esc to close</span>
                  </div>

                  <div className="overflow-x-auto rounded-xs border border-line/60">
                    <table className="w-full text-left font-mono text-xs text-muted">
                      <thead className="bg-void/80 border-b border-line/60 text-[10px] text-ink uppercase">
                        <tr>
                          <th className="px-2.5 py-1.5 font-semibold">ID</th>
                          <th className="px-2.5 py-1.5 font-semibold">Status</th>
                          <th className="px-2.5 py-1.5 font-semibold">Requirement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40">
                        {cert.objectives.map((obj) => (
                          <tr
                            key={obj.id}
                            className={`transition-colors ${
                              obj.covered
                                ? "bg-cyan/5 text-ink hover:bg-cyan/10"
                                : "bg-void/40 text-muted/70 hover:bg-void/80"
                            }`}
                          >
                            <td className="px-2.5 py-2 align-top whitespace-nowrap">
                              <span className={obj.covered ? "text-cyan font-bold" : "text-muted"}>
                                {obj.id}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 align-top whitespace-nowrap">
                              <span
                                className={`font-ui text-[10px] font-bold ${
                                  obj.covered ? "text-success" : "text-muted/60"
                                }`}
                              >
                                {obj.covered ? "✓ COVERED" : "PENDING"}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 align-top">
                              <p className="text-[11px] font-sans leading-snug text-ink/90">
                                {obj.summary}
                              </p>
                              {obj.lessonTitle && (
                                <p className="mt-0.5 font-ui text-[10px] text-cyan truncate">
                                  Via: {obj.lessonTitle}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}


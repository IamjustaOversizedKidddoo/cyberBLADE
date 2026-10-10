"use client";

import { useState } from "react";
import type { CertReadiness, GradingBand } from "@/lib/readiness/types";

function bandClass(band: GradingBand): string {
  switch (band) {
    case "Exam Ready":
      return "border-cyan bg-cyan/20 text-cyan shadow-[0_0_10px_rgba(15,190,255,0.3)]";
    case "Strong":
      return "border-cyan/70 bg-cyan/10 text-cyan";
    case "Good":
      return "border-purple bg-purple/10 text-purple";
    case "Needs review":
      return "border-pink bg-pink/10 text-pink";
    case "Weak":
    default:
      return "border-line bg-void text-muted";
  }
}

export function CertReadinessSection({ readiness }: { readiness: CertReadiness[] }) {
  const [expandedCert, setExpandedCert] = useState<string | null>(null);

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
        <span className="font-ui text-xs text-cyan border border-cyan/40 px-3 py-1">
          {readiness.length} CERTIFICATIONS TRACKED
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {readiness.map((cert) => {
          const isExpanded = expandedCert === cert.certId;

          return (
            <div
              key={cert.certId}
              className={`border p-5 transition-all ${
                isExpanded ? "border-cyan bg-console-raised" : "border-line bg-console hover:border-line/80"
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
                  className={`border px-2 py-0.5 font-ui text-[11px] font-bold tracking-widest uppercase ${bandClass(
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
                <div className="h-2 w-full bg-void overflow-hidden border border-line/40">
                  <div
                    className={`h-full transition-all duration-500 ${
                      cert.scorePercent >= 85 ? "bg-cyan" : cert.scorePercent >= 50 ? "bg-purple" : "bg-muted/40"
                    }`}
                    style={{ width: `${cert.scorePercent}%` }}
                    role="progressbar"
                    aria-valuenow={cert.scorePercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${cert.name} readiness: ${cert.scorePercent}%`}
                  />
                </div>
              </div>

              {/* Progress counter & expand toggle */}
              <div className="flex items-center justify-between border-t border-line/60 pt-3">
                <span className="font-ui text-xs text-muted">
                  <strong className="text-ink font-mono">{cert.completedObjectives}</strong> /{" "}
                  {cert.totalObjectives} Objectives
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedCert(isExpanded ? null : cert.certId)}
                  className="font-ui text-xs text-cyan hover:underline"
                >
                  {isExpanded ? "[Hide details]" : "[View matrix]"}
                </button>
              </div>

              {/* Expanded Objectives List */}
              {isExpanded && (
                <div className="mt-4 border-t border-line/60 pt-3 space-y-2 max-h-60 overflow-y-auto">
                  <p className="font-ui text-[11px] tracking-wider text-muted uppercase">
                    Objective Audit Breakdown:
                  </p>
                  <ul className="space-y-1.5 font-mono text-xs">
                    {cert.objectives.map((obj) => (
                      <li
                        key={obj.id}
                        className={`p-2 border ${
                          obj.covered ? "border-cyan/40 bg-cyan/5 text-ink" : "border-line/40 bg-void/60 text-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={obj.covered ? "text-cyan font-bold" : "text-muted/80"}>
                            {obj.id}
                          </span>
                          <span className="font-ui text-[10px]">
                            {obj.covered ? "✓ COVERED" : "PENDING"}
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug">{obj.summary}</p>
                        {obj.lessonTitle && (
                          <p className="mt-1 font-ui text-[10px] text-cyan/80 truncate">
                            Via: {obj.lessonTitle}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

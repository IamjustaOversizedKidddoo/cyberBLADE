"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { canAccessRank } from "@/lib/progress/access";

type LabSummary = {
  id: string;
  title: string;
  type: "terminal" | "packet" | "webapp" | "siem" | "soc" | "netrange";
  rank: number;
  estimatedMinutes: number;
  xp: number;
  mitre: string[];
  isChallenge: boolean;
  solved: boolean;
  linkedLessonId?: string;
  linkedLessonTitle?: string;
};

function typeBadge(type: string, isChallenge: boolean) {
  if (isChallenge) return "border-purple bg-purple/15 text-purple font-bold";
  switch (type) {
    case "terminal":
      return "border-line bg-console text-ink";
    case "packet":
      return "border-cyan bg-cyan/15 text-cyan";
    case "webapp":
      return "border-pink bg-pink/15 text-pink";
    case "siem":
      return "border-yellow-400 bg-yellow-400/15 text-yellow-300";
    case "soc":
      return "border-cyan bg-cyan/20 text-cyan font-bold";
    case "netrange":
      return "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold";
    default:
      return "border-line text-muted";
  }
}

export function LabsDirectory({
  labs,
  operatorRank,
}: {
  labs: LabSummary[];
  operatorRank: number;
}) {
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterRank, setFilterRank] = useState<number | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return labs.filter((l) => {
      if (filterType === "CHALLENGES" && !l.isChallenge) return false;
      if (filterType !== "ALL" && filterType !== "CHALLENGES" && l.type !== filterType.toLowerCase()) return false;
      if (filterRank !== "ALL" && l.rank !== filterRank) return false;
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q) ||
        l.mitre.some((m) => m.toLowerCase().includes(q)) ||
        (l.linkedLessonTitle && l.linkedLessonTitle.toLowerCase().includes(q))
      );
    });
  }, [labs, filterType, filterRank, search]);

  const solvedCount = labs.filter((l) => l.solved).length;

  return (
    <div className="space-y-8">
      {/* ── CONTROLS & TELEMETRY ─────────────────────────────────────────── */}
      <div className="rounded-xs border border-line bg-console p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-4">
          <div>
            <h2 className="font-ui text-lg font-bold text-ink tracking-wider uppercase">
              LABORATORY RANGE INVENTORY
            </h2>
            <p className="font-ui text-xs text-muted tracking-wider mt-0.5">
              BROWSE HANDS-ON TERMINALS, NETWORK ANALYZERS, WEB SECURITY EXPLOITS &amp; SIEM WORKSPACES
            </p>
          </div>
          <div className="flex items-center gap-3 font-ui text-xs">
            <span className="rounded-xs border border-cyan/40 bg-cyan/10 px-3 py-1 text-cyan font-mono">
              SOLVED: <strong>{solvedCount}</strong> / {labs.length} LABS
            </span>
            <span className="rounded-xs border border-purple/40 bg-purple/10 px-3 py-1 text-purple font-mono">
              CLEARANCE: RANK {operatorRank}
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "TERMINAL", "PACKET", "WEBAPP", "SIEM", "SOC", "NETRANGE", "CHALLENGES"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`Filter lab type: ${t}`}
                onClick={() => setFilterType(t)}
                className={`rounded-xs border px-3 py-1.5 font-ui text-xs tracking-wider transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${
                  filterType === t
                    ? "border-cyan bg-cyan/20 text-cyan font-bold"
                    : "border-line bg-void text-muted hover:text-ink hover:border-line/80"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-ui text-xs text-muted">RANK:</span>
            {(["ALL", 0, 1, 2] as const).map((r) => (
              <button
                key={String(r)}
                type="button"
                aria-label={`Filter clearance rank: ${r}`}
                onClick={() => setFilterRank(r)}
                className={`rounded-xs border px-2.5 py-1 font-mono text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-purple ${
                  filterRank === r
                    ? "border-purple bg-purple/20 text-purple font-bold"
                    : "border-line bg-void text-muted hover:text-ink"
                }`}
              >
                {r === "ALL" ? "ALL" : `R${r}`}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            Filter by lab title, MITRE ATT&CK technique, or keyword
          </label>
          <input
            ref={searchInputRef}
            id={searchInputId}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search labs by title, MITRE technique (e.g. T1110), or keywords..."
            className="w-full rounded-xs border border-line bg-console-deep px-4 py-2 text-xs font-mono text-ink placeholder:text-muted/60 focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          />
          <div className="absolute right-3 top-2 hidden sm:flex items-center gap-1.5 pointer-events-none">
            <span className="text-[10px] text-secondary font-ui">Press</span>
            <Kbd>/</Kbd>
          </div>
        </div>
      </div>

      {/* ── LABS GRID ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No labs match query criteria"
          description="Try selecting ALL filters or clearing search terms."
          action={
            <button
              type="button"
              onClick={() => {
                setFilterType("ALL");
                setFilterRank("ALL");
                setSearch("");
              }}
              className="rounded-xs border border-cyan/60 px-4 py-1.5 font-ui text-xs text-cyan hover:bg-cyan hover:text-void transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const unlocked = canAccessRank(operatorRank, l.rank);
            const targetHref = l.isChallenge ? `/challenge/${l.rank}` : `/labs/${l.id}`;

            return (
              <div
                key={l.id}
                className={`rounded-xs border p-5 flex flex-col justify-between transition-all ${
                  l.solved
                    ? "border-purple/60 bg-console hover:border-purple"
                    : unlocked
                    ? "border-line bg-console hover:border-cyan"
                    : "border-line/60 bg-void/50"
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`rounded-xs border px-2 py-0.5 font-ui text-[10px] tracking-wider uppercase ${typeBadge(l.type, l.isChallenge)}`}>
                      {l.isChallenge ? "TIMED CHALLENGE" : l.type.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1.5 font-ui text-xs">
                      <span className="text-secondary">RANK_{l.rank}</span>
                      <span className="text-line">·</span>
                      <span className="text-cyan font-mono">{l.xp} XP</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-ui text-base font-bold text-ink leading-snug">
                    {l.title}
                  </h3>

                  {/* Linked Lesson */}
                  {l.linkedLessonTitle && (
                    <p className="mt-1.5 font-ui text-xs text-secondary truncate">
                      Linked: <span className="text-ink/90">{l.linkedLessonTitle}</span>
                    </p>
                  )}

                  {/* Metadata: Minutes & MITRE */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono text-secondary">
                    <span>⏱ {l.estimatedMinutes} min</span>
                    {l.mitre.length > 0 && (
                      <span className="text-purple">
                        ATT&amp;CK: {l.mitre.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="mt-5 pt-3 border-t border-line/60 flex items-center justify-between">
                  <span className="font-ui text-xs">
                    {l.solved ? (
                      <span className="text-purple font-bold">✓ SOLVED</span>
                    ) : unlocked ? (
                      <span className="text-cyan">READY</span>
                    ) : (
                      <span className="text-secondary font-medium">🔒︎ LOCKED</span>
                    )}
                  </span>

                  {unlocked ? (
                    <Link
                      href={targetHref}
                      className="rounded-xs border border-cyan px-3 py-1 font-ui text-xs text-cyan hover:bg-cyan hover:text-void transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                    >
                      {l.solved ? "RETRY →" : "LAUNCH →"}
                    </Link>
                  ) : (
                    <span className="font-ui text-[11px] text-secondary">
                      Clear R{l.rank - 1} challenge
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconClock, IconAlertTriangle, IconFlame } from "@/components/ui/icons";

const format = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatSpoken = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} seconds remaining`;
  if (s === 0) return `${m} minutes remaining`;
  return `${m} minutes and ${s} seconds remaining`;
};

/** Display only: the deadline is enforced on the server. */
export function ChallengeTimer({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const deadline = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const announcedThresholds = useRef<Set<number>>(new Set());

  const left = deadline - now;
  const isWarning = left < 5 * 60_000;
  const isCritical = left < 60_000;

  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);

      const msLeft = deadline - t;
      // Threshold announcements at 10m, 5m, 1m
      if (msLeft <= 10 * 60_000 && msLeft > 9.9 * 60_000 && !announcedThresholds.current.has(10)) {
        announcedThresholds.current.add(10);
        setAnnouncement("Attention: 10 minutes remaining in challenge.");
      } else if (msLeft <= 5 * 60_000 && msLeft > 4.9 * 60_000 && !announcedThresholds.current.has(5)) {
        announcedThresholds.current.add(5);
        setAnnouncement("Warning: 5 minutes remaining in challenge.");
      } else if (msLeft <= 60_000 && msLeft > 55_000 && !announcedThresholds.current.has(1)) {
        announcedThresholds.current.add(1);
        setAnnouncement("Critical: 1 minute remaining in challenge.");
      }

      if (t >= deadline) {
        clearInterval(timer);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, router]);

  const announceCurrentTime = () => {
    setAnnouncement(`Current time remaining: ${formatSpoken(left)}.`);
  };

  const statusConfig = isCritical
    ? {
        border: "border-danger text-danger bg-danger/10 animate-pulse",
        icon: <IconFlame className="h-4 w-4 text-danger shrink-0" />,
        label: "CRITICAL",
      }
    : isWarning
    ? {
        border: "border-warning text-warning bg-warning/10",
        icon: <IconAlertTriangle className="h-4 w-4 text-warning shrink-0" />,
        label: "FINAL 5M",
      }
    : {
        border: "border-cyan/50 text-cyan bg-cyan/5",
        icon: <IconClock className="h-4 w-4 text-cyan shrink-0" />,
        label: "OPERATIONAL",
      };

  return (
    <div className="flex items-center gap-2">
      {/* Polite Aria-Live Region for Threshold and On-Demand Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {announcement}
      </div>

      <div
        className={`flex items-center gap-2 rounded-xs border px-2.5 py-1 font-ui text-xs tracking-wider uppercase ${statusConfig.border}`}
      >
        {statusConfig.icon}
        <span className="hidden sm:inline font-mono text-[10px] text-muted">
          [{statusConfig.label}]
        </span>
        <span
          role="timer"
          aria-label={`${format(left)} remaining - ${statusConfig.label}`}
          className="font-mono text-base sm:text-lg font-bold leading-none text-ink"
        >
          {format(left)}
        </span>
      </div>

      {/* Screen reader button to query remaining time on demand */}
      <button
        type="button"
        onClick={announceCurrentTime}
        className="rounded-xs border border-line bg-surface px-2 py-1 font-mono text-[10px] text-muted hover:border-cyan hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan min-h-[32px]"
        aria-label="Announce time remaining to screen reader"
        title="Announce remaining time"
      >
        Query Time
      </button>
    </div>
  );
}

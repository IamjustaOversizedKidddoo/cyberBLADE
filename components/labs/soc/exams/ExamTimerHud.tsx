"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocExamStateAction } from "@/app/(app)/labs/soc/exams/actions";
import { IconAlertTriangle } from "@/components/ui/icons";
import { clock, spokenDuration } from "./format";

const WARNINGS = [600, 300, 60] as const;
const RESYNC_MS = 60_000;

type Props = {
  examId: string;
  deadlineAt: string;
  serverNow: string;
  onExpired: () => void;
};

/**
 * Server-synced countdown. The deadline comes from the server; the device clock is only used
 * for the difference since the last sync, and every minute (and on tab focus) the HUD re-syncs.
 * Warnings are text with an icon (never colour alone) and are announced once each; the rest of
 * the time the live region stays silent unless the learner asks for the time.
 */
export function ExamTimerHud({ examId, deadlineAt, serverNow, onExpired }: Props) {
  const offsetRef = useRef(0);
  const deadlineRef = useRef(Date.parse(deadlineAt));
  const firedRef = useRef(new Set<number>());
  const expiredRef = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const secondsLeft = useCallback(() => Math.max(0, Math.floor((deadlineRef.current - (Date.now() + offsetRef.current)) / 1000)), []);

  const tick = useCallback(() => {
    const left = secondsLeft();
    setRemaining(left);
    for (const t of WARNINGS) {
      if (left <= t && left > 0 && !firedRef.current.has(t)) {
        // Mark every threshold already passed (e.g. on reload at 4 minutes) but announce only the latest.
        for (const u of WARNINGS) if (u >= t) firedRef.current.add(u);
        const text = `${spokenDuration(t)} left. Your work is saved; the exam submits itself at zero.`;
        setWarning(text);
        setAnnouncement(text);
        break;
      }
    }
    if (left === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpired();
    }
  }, [onExpired, secondsLeft]);

  const resync = useCallback(async () => {
    try {
      const s = await getSocExamStateAction(examId);
      offsetRef.current = Date.parse(s.serverNow) - Date.now();
      deadlineRef.current = Date.parse(s.deadlineAt);
      if (s.status !== "active" && !expiredRef.current) {
        expiredRef.current = true;
        onExpired();
      }
      tick();
    } catch {
      // Keep counting from the last sync; the server enforces the deadline either way.
    }
  }, [examId, onExpired, tick]);

  useEffect(() => {
    offsetRef.current = Date.parse(serverNow) - Date.now();
    deadlineRef.current = Date.parse(deadlineAt);
    // Thresholds already passed before this page loaded are not re-announced.
    const left = secondsLeft();
    for (const t of WARNINGS) if (left <= t) firedRef.current.add(t);
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    const sync = window.setInterval(resync, RESYNC_MS);
    const onVisible = () => document.visibilityState === "visible" && resync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      window.clearInterval(sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deadlineAt, serverNow, resync, secondsLeft, tick]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2 font-ui text-sm" role="group" aria-label="Exam timer">
      <p className={`flex items-center gap-1.5 ${remaining !== null && remaining < 120 ? "text-danger border border-danger/60 bg-danger/10 rounded-xs px-2 py-0.5 animate-pulse" : "text-secondary"}`}>
        <span>Time left</span>{" "}
        <span className={`font-mono text-base font-bold tabular-nums ${remaining !== null && remaining < 120 ? "text-danger" : "text-ink"}`} aria-hidden="true">
          {remaining === null ? "--:--" : clock(remaining)}
        </span>
        <span className="sr-only">{remaining === null ? "loading" : spokenDuration(remaining)}</span>
      </p>
      <button
        type="button"
        onClick={() => setAnnouncement(`${spokenDuration(secondsLeft())} left.`)}
        className="min-h-[44px] rounded-xs border border-line bg-surface-raised px-3 text-xs text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-cyan sm:min-h-[32px]"
      >
        Announce time remaining
      </button>
      {warning && (
        <p className="flex items-center gap-1.5 text-ink">
          <IconAlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>{warning}</span>
        </p>
      )}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

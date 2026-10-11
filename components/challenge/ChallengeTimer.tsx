"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClock, IconAlertTriangle, IconFlame } from "@/components/ui/icons";

const format = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Display only: the deadline is enforced on the server. */
export function ChallengeTimer({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const deadline = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) {
        clearInterval(timer);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, router]);

  const left = deadline - now;
  const isWarning = left < 5 * 60_000;
  const isCritical = left < 60_000;

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
    <div
      className={`flex items-center gap-2.5 rounded-xs border px-3 py-1.5 font-ui text-xs tracking-wider uppercase ${statusConfig.border}`}
    >
      {statusConfig.icon}
      <span className="hidden sm:inline font-mono text-[10px] text-muted">
        [{statusConfig.label}]
      </span>
      <span
        role="timer"
        aria-label={`${format(left)} remaining - ${statusConfig.label}`}
        className="font-mono text-lg font-bold leading-none text-ink"
      >
        {format(left)}
      </span>
    </div>
  );
}

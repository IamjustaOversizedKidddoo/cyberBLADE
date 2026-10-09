"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

  return (
    <div className={`flex items-center gap-2 border px-3 py-1.5 font-ui text-xs tracking-widest ${
      isCritical
        ? "border-pink text-pink animate-pulse"
        : isWarning
        ? "border-pink/60 text-pink"
        : "border-line text-muted"
    }`}>
      <span className="hidden sm:inline text-muted/60">T-MINUS</span>
      <span role="timer" aria-label={`${format(left)} remaining`} className="font-display text-xl leading-none">
        {format(left)}
      </span>
    </div>
  );
}

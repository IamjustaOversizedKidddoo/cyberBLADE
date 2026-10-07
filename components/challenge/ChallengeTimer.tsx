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
  return (
    <p className="font-ui text-xl">
      Time left:{" "}
      <span role="timer" className={left < 5 * 60_000 ? "text-pink" : "text-cyan"}>
        {format(left)}
      </span>
    </p>
  );
}

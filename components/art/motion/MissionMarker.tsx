"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import { readReducedMotion } from "./reduced";

/**
 * "You are here" on the campaign path: a square target with a ring that pulses on the current
 * mission. Static (no pulse) with reduced motion. Decorative — the rank's status is written in text.
 */
export function MissionMarker({ active }: { active: boolean }) {
  const ring = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active || !ring.current || readReducedMotion()) return;
    const controls = animate(ring.current, { scale: [1, 1.9], opacity: [0.9, 0] }, { duration: 1.6, repeat: Infinity, ease: "easeOut" });
    return () => controls.stop();
  }, [active]);

  return (
    <span aria-hidden="true" className={`relative inline-flex h-5 w-5 items-center justify-center ${active ? "text-cyan" : "text-muted"}`}>
      {active && <span ref={ring} data-marker-ring="" className="absolute inset-0 border-2 border-current" />}
      <span className={`block h-3 w-3 border-2 border-current ${active ? "bg-current" : ""}`} />
    </span>
  );
}

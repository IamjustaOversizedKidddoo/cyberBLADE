"use client";

import { animate } from "motion/react";
import { useRef } from "react";
import { readReducedMotion } from "./reduced";

/**
 * Pulls one interactive child a few pixels toward the pointer (mouse/trackpad only).
 * Never changes focus order or keyboard behaviour; off with reduced motion and on touch screens.
 */
export function Magnetic({ strength = 8, children }: { strength?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  const allowed = () => !readReducedMotion() && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !allowed()) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength;
    const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength;
    animate(el, { x: dx, y: dy }, { duration: 0.15 });
  };
  const onLeave = () => {
    if (ref.current) animate(ref.current, { x: 0, y: 0 }, { duration: 0.3 });
  };

  return (
    <span ref={ref} className="inline-block" onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </span>
  );
}

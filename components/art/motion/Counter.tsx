"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import { readReducedMotion } from "./reduced";

type Props = { to: number; format?: (n: number) => string; grouped?: boolean; className?: string };

const groupThousands = (n: number) => n.toLocaleString("en-US");

/** A number that counts up when it comes into view. The markup always holds the final value. */
export function Counter({ to, format: custom, grouped = false, className }: Props) {
  const format = custom ?? (grouped ? groupThousands : String);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || to === 0 || readReducedMotion() || typeof IntersectionObserver === "undefined") return;
    let stop: (() => void) | undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const controls = animate(0, to, { duration: 1.1, ease: "easeOut", onUpdate: (v) => (el.textContent = format(Math.round(v))) });
      stop = () => controls.stop();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      stop?.();
      el.textContent = format(to);
    };
  }, [to, format]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {format(to)}
      </span>
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}

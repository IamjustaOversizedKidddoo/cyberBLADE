"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import { readReducedMotion } from "./reduced";

type Mode = "clip" | "mask" | "rise";

const FROM: Record<Mode, Record<string, string | number>> = {
  clip: { clipPath: "inset(0 0 100% 0)" },
  mask: { clipPath: "inset(0 100% 0 0)" },
  rise: { opacity: 0, transform: "translateY(24px)" },
};
const TO: Record<Mode, Record<string, string | number>> = {
  clip: { clipPath: "inset(0 0 0% 0)" },
  mask: { clipPath: "inset(0 0% 0 0)" },
  rise: { opacity: 1, transform: "translateY(0px)" },
};

type Props = { mode?: Mode; delay?: number; className?: string; children: React.ReactNode };

/**
 * Shows its children with a clip/mask/rise entrance when they scroll into view.
 * The server HTML is the final state; the entrance is only set up after hydration, only for content
 * still below the fold, and never with reduced motion — so nothing can stay hidden.
 */
export function Reveal({ mode = "rise", delay = 0, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || readReducedMotion() || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already visible: leave it alone
    Object.assign(el.style, FROM[mode]);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        animate(el, TO[mode], { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      Object.assign(el.style, TO[mode]);
    };
  }, [mode, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

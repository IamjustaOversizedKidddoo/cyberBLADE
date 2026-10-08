"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { useReducedMotion } from "./reduced";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Props = {
  /** Hold the section in place while the scroll plays it. */
  pin?: boolean;
  /** Tie progress to the scrollbar (true) or smooth it by N seconds. */
  scrub?: boolean | number;
  /** Number of steps; the current one is published as data-step (0-based). */
  steps?: number;
  /** Below this viewport width the scene is a static composition. */
  minWidth?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * The only place scroll storytelling (GSAP + ScrollTrigger) happens. It publishes progress as
 * `data-step` and the `--scene-progress` CSS variable on its root; the server-rendered art inside
 * reacts through CSS. With reduced motion, or on small screens, nothing is created: the children
 * stay the complete, final composition. This module is only bundled on pages that render it.
 */
export function ScrollScene({ pin = false, scrub = true, steps = 1, minWidth = 768, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      const mm = gsap.matchMedia();
      mm.add(`(min-width: ${minWidth}px)`, () => {
        el.dataset.step = "0";
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: pin ? "top top" : "top 85%",
          end: pin ? `+=${Math.max(1, steps) * 70}%` : "bottom 25%",
          pin,
          scrub,
          onUpdate: (self) => {
            el.dataset.step = String(Math.min(steps - 1, Math.floor(self.progress * steps)));
            el.style.setProperty("--scene-progress", self.progress.toFixed(3));
          },
        });
        return () => {
          trigger.kill();
          delete el.dataset.step;
          el.style.removeProperty("--scene-progress");
        };
      });
      return () => mm.revert();
    },
    { dependencies: [reduced, pin, scrub, steps, minWidth], scope: ref, revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={className} data-scene="">
      {children}
    </div>
  );
}

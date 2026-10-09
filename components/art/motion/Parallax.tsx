"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { useReducedMotion } from "./reduced";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Drifts its child vertically as the page scrolls (speed: % of its own height over the scroll range;
 * negative = up). Off with reduced motion and below 768 px. Bundled only where it is rendered.
 */
export function Parallax({ speed = -12, className, children }: { speed?: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        gsap.fromTo(el, { yPercent: 0 }, { yPercent: speed, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
      return () => mm.revert();
    },
    { dependencies: [reduced, speed], scope: ref, revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

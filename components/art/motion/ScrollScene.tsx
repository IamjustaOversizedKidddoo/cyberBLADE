"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { buildScene, type GsapLike } from "@/lib/art/scene";
import { useReducedMotion } from "./reduced";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Props = {
  /** Hold the scene in place while scrolling plays it (desktop). */
  pin?: boolean;
  /** Tie progress to the scrollbar (true) or smooth it by N seconds. */
  scrub?: boolean | number;
  /** Scroll distance of a pinned scene, in viewport heights. */
  length?: number;
  /** Number of steps; the current one is published as data-step (0-based). */
  steps?: number;
  /** Below this width the scene is the phone version. */
  minWidth?: number;
  /** Phones: "static" = final composition, "play" = the same timeline plays once (faster) on arrival. */
  mobile?: "static" | "play";
  className?: string;
  children: React.ReactNode;
};

/**
 * A cinematic scene: one GSAP timeline built from the scene language in its children (lib/art/scene.ts),
 * scrubbed by scroll on wide screens. Publishes `data-step` and `--scene-progress` for CSS. With reduced
 * motion nothing is built and the server-rendered final composition stays. The media-query context
 * reverts and rebuilds the scene when the window crosses `minWidth`. Bundled only on pages that use it.
 */
export function ScrollScene({ pin = false, scrub = true, length = 2, steps = 1, minWidth = 768, mobile = "static", className = "", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      const api = gsap as unknown as GsapLike;
      const progress = (p: number) => {
        el.dataset.step = String(Math.min(steps - 1, Math.floor(p * steps)));
        el.style.setProperty("--scene-progress", p.toFixed(3));
      };
      const mm = gsap.matchMedia();
      mm.add(`(min-width: ${minWidth}px)`, () => {
        el.dataset.step = "0";
        buildScene(api, el, { desktop: true, pin, scrub, length, onProgress: progress });
        return () => {
          delete el.dataset.step;
          el.style.removeProperty("--scene-progress");
        };
      });
      if (mobile === "play") {
        mm.add(`(max-width: ${minWidth - 1}px)`, () => {
          buildScene(api, el, { desktop: false, pin: false, scrub: false, length, onProgress: () => {} });
        });
      }
      return () => mm.revert();
    },
    { dependencies: [reduced, pin, scrub, length, steps, minWidth, mobile], scope: ref, revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={`scene-stage ${className}`} data-scene="">
      {children}
    </div>
  );
}

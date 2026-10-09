"use client";

import { useEffect, useRef, useState } from "react";
import { BladeMark } from "../BladeMark";
import { useReducedMotion } from "./reduced";
import { canRunBlade, loadThree } from "./three-loader";

/**
 * CYBERBLADE's 3D blade — cinematic punctuation, not a 3D site. Server HTML (and every phone, touch
 * screen, reduced-motion visitor or browser without WebGL2) shows the drawn BladeMark. On a capable
 * desktop, three.js is fetched once the page is idle and the WebGL blade fades in over the drawing.
 * Decorative.
 */
export function BladeObject({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (reduced || !canRunBlade()) return;
    let cancelled = false;
    let stop = () => {};
    const start = () => {
      loadThree().then(async (THREE) => {
        if (cancelled || !host.current) return;
        const { mountBlade } = await import("./blade-scene");
        if (cancelled || !host.current) return;
        stop = mountBlade(THREE, host.current, () => setLive(false));
        setLive(true);
      });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 2500 }) : window.setTimeout(start, 800);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      stop();
      setLive(false);
    };
  }, [reduced]);

  return (
    <div ref={host} aria-hidden="true" className={`relative ${className}`}>
      <BladeMark className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`} />
    </div>
  );
}

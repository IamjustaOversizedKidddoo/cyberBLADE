"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";
import { useReducedMotion } from "./reduced";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth, camera-like scrolling for cinematic pages only (landing, dashboard, course map) — mount it
 * on those pages, never in a layout. Off with reduced motion, on touch screens and below 768 px; lessons
 * and labs keep native scrolling. Keyboard, anchors and focus keep working: Lenis drives the real
 * window scroll and handles in-page anchors itself; ScrollTrigger is updated from it every frame.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion();

  useEffect(() => {
    const allowed = !reduced && !window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(min-width: 768px)").matches;
    if (!allowed) return;
    const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.09 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Keyboard focus wins: when Tab (or a skip link) lands on something off-screen, go straight to it.
    // Otherwise Lenis keeps its old target and glides the page away from what the user is focused on.
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) lenis.scrollTo(el, { offset: -window.innerHeight / 3, immediate: true });
    };
    document.addEventListener("focusin", onFocus);
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) {
        return;
      }
      if (e.key === "Home") {
        lenis.scrollTo(0, { immediate: true });
      } else if (e.key === "End") {
        lenis.scrollTo("bottom", { immediate: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("keydown", onKeyDown);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [reduced]);

  return null;
}

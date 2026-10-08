"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Reduced motion is on when the operating system asks for it OR NEON's "Reduce motion" toggle is pressed. */
export function readReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.motion === "reduce" || window.matchMedia?.(QUERY).matches === true;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  const mql = window.matchMedia?.(QUERY);
  mql?.addEventListener?.("change", onChange);
  return () => {
    observer.disconnect();
    mql?.removeEventListener?.("change", onChange);
  };
}

/** Live: flips as soon as the toggle or the OS setting changes. False during server rendering. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readReducedMotion, () => false);
}

import { readReducedMotion } from "./reduced";

/** The only place three.js is requested: a separate chunk, fetched on demand. */
export const loadThree = () => import("three");

/**
 * The 3D blade runs only where it adds something and costs little: a wide desktop window (≥ 1024 px),
 * a mouse/trackpad, motion allowed, and WebGL2. Everyone else sees the drawn BladeMark.
 */
interface NavigatorExtended extends Navigator {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

export function canRunBlade(): boolean {
  if (typeof window === "undefined" || readReducedMotion()) return false;
  const nav = navigator as NavigatorExtended;
  if (nav?.connection?.saveData) return false;
  if (typeof nav?.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if (typeof nav?.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return false;
  if (!window.matchMedia("(min-width: 1024px)").matches || !window.matchMedia("(pointer: fine)").matches) return false;
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

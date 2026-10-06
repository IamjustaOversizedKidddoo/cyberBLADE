"use client";

import { useSyncExternalStore } from "react";
import type { DisplayPrefs } from "./display-prefs";

// The <html> data attributes are the single source of truth (set by the boot script and DisplaySettings).
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion", "data-contrast"] });
  return () => observer.disconnect();
}

function snapshot(): string {
  const { motion, contrast } = document.documentElement.dataset;
  return `${motion === "reduce" ? "reduce" : "full"}|${contrast === "high" ? "high" : "normal"}`;
}

const SERVER_SNAPSHOT = "full|normal";

export function useDisplayPrefs(): DisplayPrefs {
  const [motion, contrast] = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT).split("|");
  return { motion: motion as DisplayPrefs["motion"], contrast: contrast as DisplayPrefs["contrast"] };
}

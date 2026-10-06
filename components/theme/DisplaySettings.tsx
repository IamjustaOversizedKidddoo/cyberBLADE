"use client";

import { applyPrefs, savePrefs, type DisplayPrefs } from "@/lib/theme/display-prefs";
import { useDisplayPrefs } from "@/lib/theme/use-display-prefs";

export function DisplaySettings() {
  const prefs = useDisplayPrefs();

  function update(next: DisplayPrefs) {
    applyPrefs(document.documentElement, next);
    savePrefs(next);
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="neon-toggle"
        aria-pressed={prefs.motion === "reduce"}
        onClick={() => update({ ...prefs, motion: prefs.motion === "reduce" ? "full" : "reduce" })}
      >
        Reduce motion
      </button>
      <button
        type="button"
        className="neon-toggle"
        aria-pressed={prefs.contrast === "high"}
        onClick={() => update({ ...prefs, contrast: prefs.contrast === "high" ? "normal" : "high" })}
      >
        High contrast
      </button>
    </div>
  );
}

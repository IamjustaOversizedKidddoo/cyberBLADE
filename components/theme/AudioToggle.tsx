"use client";

import { useSyncExternalStore } from "react";
import { isAudioEnabled, setAudioEnabled, playKeyBlip, subscribeAudio } from "@/lib/audio/sound-fx";
import { IconVolume2, IconVolumeX } from "@/components/ui/icons";

export function AudioToggle({ className = "" }: { className?: string }) {
  const enabled = useSyncExternalStore(subscribeAudio, isAudioEnabled, () => false);

  const toggle = () => {
    const next = !enabled;
    setAudioEnabled(next);
    if (next) {
      setTimeout(() => playKeyBlip(), 50);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Disable audio effects" : "Enable audio effects"}
      className={`inline-flex items-center gap-1.5 border border-line bg-surface-subtle px-2.5 py-1 font-mono text-xs text-muted hover:border-cyan hover:text-cyan transition-colors ${className}`}
    >
      {enabled ? (
        <>
          <IconVolume2 className="h-3.5 w-3.5 text-cyan" />
          <span className="hidden sm:inline">AUDIO: ON</span>
        </>
      ) : (
        <>
          <IconVolumeX className="h-3.5 w-3.5 opacity-60" />
          <span className="hidden sm:inline">AUDIO: MUTED</span>
        </>
      )}
    </button>
  );
}

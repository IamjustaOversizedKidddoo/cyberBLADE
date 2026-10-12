import { readReducedMotion } from "@/components/art/motion/reduced";

let audioCtx: AudioContext | null = null;

interface NavigatorWithSaveData extends Navigator {
  connection?: { saveData?: boolean };
}

export function isAudioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (readReducedMotion()) return false;
  const nav = navigator as NavigatorWithSaveData;
  if (nav?.connection?.saveData) return false;
  return localStorage.getItem("cyberblade_audio") === "true";
}

export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("cyberblade_audio", enabled ? "true" : "false");
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined" || !isAudioEnabled()) return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Synthesize a subtle 20ms terminal key click without downloading any media files. */
export function playKeyBlip(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.02);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    // ignore audio failure
  }
}

/** Synthesize a subtle mission complete chime. */
export function playSuccessChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.12); // G5

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.25);
  } catch {
    // ignore
  }
}

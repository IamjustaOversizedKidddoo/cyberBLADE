export type DisplayPrefs = { motion: "full" | "reduce"; contrast: "normal" | "high" };

export const PREFS_KEY = "neon.display";

export function readPrefs(storage: Pick<Storage, "getItem">, osReducedMotion: boolean): DisplayPrefs {
  const prefs: DisplayPrefs = { motion: osReducedMotion ? "reduce" : "full", contrast: "normal" };
  try {
    const stored = JSON.parse(storage.getItem(PREFS_KEY) ?? "null");
    if (stored?.motion === "full" || stored?.motion === "reduce") prefs.motion = stored.motion;
    if (stored?.contrast === "normal" || stored?.contrast === "high") prefs.contrast = stored.contrast;
  } catch {
    // Unreadable or blocked storage: keep defaults.
  }
  return prefs;
}

export function applyPrefs(root: HTMLElement, p: DisplayPrefs): void {
  root.dataset.motion = p.motion;
  root.dataset.contrast = p.contrast;
}

export function savePrefs(p: DisplayPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private mode / blocked storage: preference lasts for this page only.
  }
}

/**
 * Inline <head> script: applies saved prefs before first paint so there is no flash.
 * Must be fully self-contained (it runs outside the bundle) and mirror readPrefs/applyPrefs.
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,p={motion:matchMedia("(prefers-reduced-motion: reduce)").matches?"reduce":"full",contrast:"normal"};
try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"null");
if(s&&(s.motion==="full"||s.motion==="reduce"))p.motion=s.motion;
if(s&&(s.contrast==="normal"||s.contrast==="high"))p.contrast=s.contrast;}catch(e){}
d.dataset.motion=p.motion;d.dataset.contrast=p.contrast;}catch(e){}})();`;

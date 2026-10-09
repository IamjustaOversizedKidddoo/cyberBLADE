/**
 * The palette tokens art may use, plus "current": inherit the band's text colour. Inside bands prefer
 * "current" — inline token colours would not follow high contrast's dark-band remap.
 */
export type Tone = "current" | "void" | "ink" | "paper" | "muted" | "cyan" | "purple" | "pink";

export const toneVar = (tone: Tone) => (tone === "current" ? "currentColor" : `var(--color-${tone})`);

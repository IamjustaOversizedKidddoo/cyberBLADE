/** The palette tokens art may use. Art is coloured only through these, so high contrast can remap them. */
export type Tone = "void" | "ink" | "paper" | "muted" | "cyan" | "purple" | "pink";

export const toneVar = (tone: Tone) => `var(--color-${tone})`;

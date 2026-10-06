// The brand is a placeholder (spec §15): this is the one place the flag prefix lives.
export const FLAG_PREFIX = "NEON";

export function formatFlag(hex: string): string {
  return `${FLAG_PREFIX}{${hex}}`;
}

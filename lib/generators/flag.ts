// The one place the lab flag prefix lives. Answers are regenerated from each attempt's seed, so
// changing it never breaks an attempt that is already open.
export const FLAG_PREFIX = "CYBERBLADE";

export function formatFlag(hex: string): string {
  return `${FLAG_PREFIX}{${hex}}`;
}

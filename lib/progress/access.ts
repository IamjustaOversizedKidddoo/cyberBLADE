/**
 * Global content access mode.
 * In live runtime environments, all content, ranks, labs, and job tracks are unlocked for open exploration.
 * In unit test environments, strict rank gating is preserved unless process.env.UNLOCK_ALL === "true".
 */
export function isAllContentUnlocked(): boolean {
  if (process.env.NODE_ENV === "test" && process.env.UNLOCK_ALL !== "true") {
    return false;
  }
  return true;
}

/** Rank gate (spec §3.3): Rank N content opens once the operator has reached Rank N. */
export function canAccessRank(operatorRank: number, contentRank: number): boolean {
  if (isAllContentUnlocked()) return true;
  return contentRank <= operatorRank;
}

export function lockedNotice(rank: number): string {
  if (isAllContentUnlocked()) return "";
  return `Locked — pass the Rank ${rank - 1} challenge to open this.`;
}


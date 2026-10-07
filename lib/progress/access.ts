/** Rank gate (spec §3.3): Rank N content opens once the operator has reached Rank N. */
export function canAccessRank(operatorRank: number, contentRank: number): boolean {
  return contentRank <= operatorRank;
}

export function lockedNotice(rank: number): string {
  return `Locked — pass the Rank ${rank - 1} challenge to open this.`;
}

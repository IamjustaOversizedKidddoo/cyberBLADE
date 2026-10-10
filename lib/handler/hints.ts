import type { LoadedLab } from "@/lib/lab-engine/lab-schema";

export type HintProgression = {
  objectiveId: string;
  tier: number;
  hintText: string;
  totalTiers: number;
  allUnlockedHints: string[];
  newHintsUsedCount: number;
};

/**
 * Computes the next graduated hint for a lab objective.
 * Tier 1: Nudge (syntax / concept)
 * Tier 2: Direction (file path / tool flags)
 * Tier 3: Walkthrough (step-by-step investigation)
 */
export function getNextLabHint(
  lab: LoadedLab,
  objectiveId: string,
  currentHintsUsed: number,
): HintProgression | null {
  const objectiveHints = lab.hints[objectiveId];
  if (!objectiveHints || objectiveHints.length === 0) {
    return null;
  }

  const totalTiers = objectiveHints.length;
  // If user already used all tiers, repeat tier 3
  const targetIndex = Math.min(currentHintsUsed, totalTiers - 1);
  const tier = targetIndex + 1;
  const hintText = objectiveHints[targetIndex];
  const allUnlockedHints = objectiveHints.slice(0, targetIndex + 1);
  const newHintsUsedCount = Math.max(currentHintsUsed, targetIndex + 1);

  return {
    objectiveId,
    tier,
    hintText,
    totalTiers,
    allUnlockedHints,
    newHintsUsedCount,
  };
}

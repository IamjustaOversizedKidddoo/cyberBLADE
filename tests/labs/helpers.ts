import { checkObjective, generateLab } from "@/lib/lab-engine/checks";
import { loadLab } from "@/lib/lab-engine/labs";
import { createShell } from "@/lib/lab-engine/terminal/shell";

export const FLAG = /NEON\{[0-9a-f]{12}\}/;

/** Loads a real lab, builds its world for a seed, and gives a shell + an answer checker. */
export async function openLab(labId: string, seed: string) {
  const lab = await loadLab(labId);
  const { world, answers } = generateLab(lab, seed);
  const sh = createShell(world);
  const run = (cmd: string) => sh.exec(cmd);
  const check = (objectiveId: string, answer: string) => checkObjective(lab, answers, objectiveId, answer);
  return { lab, world, answers, sh, run, check };
}

export const SEEDS = ["seed-a", "seed-b", "seed-c", "learner-42", "exam-7"];

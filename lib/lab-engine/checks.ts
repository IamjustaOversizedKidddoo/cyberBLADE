import { GENERATORS, type Generator, type GeneratorOutput } from "@/lib/generators";
import { createRng } from "@/lib/generators/rng";
import { assertEnvMatchesLab } from "./env";
import type { Lab } from "./lab-schema";

/** Builds the lab's machine and its answer key from a seed. Same seed → same lab. */
export function generateLab(lab: Lab, seed: string, registry: Record<string, Generator> = GENERATORS): GeneratorOutput {
  const generator = Object.hasOwn(registry, lab.dataset.generator) ? registry[lab.dataset.generator] : undefined;
  if (!generator) throw new Error(`lab ${lab.id}: unknown generator ${lab.dataset.generator}`);
  // Namespacing by lab id keeps two labs with the same seed from producing the same data.
  const out = generator(createRng(`${lab.id}:${seed}`), lab.dataset.params);
  assertEnvMatchesLab(lab, out.env);
  return out;
}

/** Trims (incl. newlines from copy-paste) and collapses inner runs of whitespace. */
export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function checkObjective(lab: Lab, answers: Record<string, string>, objectiveId: string, submitted: string): boolean {
  const objective = lab.objectives.find((o) => o.id === objectiveId);
  if (!objective) throw new Error(`lab ${lab.id}: unknown objective ${objectiveId}`);
  const key = objective.check.answer_from.slice("generator.".length);
  if (!Object.hasOwn(answers, key)) throw new Error(`lab ${lab.id}: generator gave no answer for ${key} (missing)`);
  const expected = normalizeAnswer(answers[key]);
  const given = normalizeAnswer(submitted);
  if (given === "") return false;
  return objective.check.case_sensitive ? given === expected : given.toLowerCase() === expected.toLowerCase();
}

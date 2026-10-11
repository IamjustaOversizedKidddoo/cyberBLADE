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

/** Trims whitespace, strips matching outer quotes, and collapses inner whitespace. */
export function normalizeAnswer(s: string): string {
  let trimmed = s.trim().replace(/\s+/g, " ");
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim().replace(/\s+/g, " ");
  }
  return trimmed;
}

export function checkObjective(lab: Lab, answers: Record<string, string>, objectiveId: string, submitted: string): boolean {
  const objective = lab.objectives.find((o) => o.id === objectiveId);
  if (!objective) throw new Error(`lab ${lab.id}: unknown objective ${objectiveId}`);
  const key = objective.check.answer_from.slice("generator.".length);
  if (!Object.hasOwn(answers, key)) throw new Error(`lab ${lab.id}: generator gave no answer for ${key} (missing)`);
  const expected = normalizeAnswer(answers[key]);
  let given = normalizeAnswer(submitted);
  if (given === "") return false;

  // Tolerant flag normalization: if expected is a flag like FOO{bar} and learner included trailing dot or semicolon
  if (expected.includes("{") && expected.endsWith("}")) {
    if ((given.endsWith("}.") || given.endsWith("};")) && given.length === expected.length + 1) {
      given = given.slice(0, -1);
    }
  }

  return objective.check.case_sensitive ? given === expected : given.toLowerCase() === expected.toLowerCase();
}

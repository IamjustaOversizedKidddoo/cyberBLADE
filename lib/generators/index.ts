import type { World } from "@/lib/lab-engine/terminal/types";
import type { Rng } from "./rng";

export type GeneratorOutput = { world: World; answers: Record<string, string> };

// Params come from lab.yaml, so generators validate what they read.
export type Generator = (rng: Rng, params: Record<string, unknown>) => GeneratorOutput;

/** Registered by name; lab.yaml `dataset.generator` picks one. */
export const GENERATORS: Record<string, Generator> = {};

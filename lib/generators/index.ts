import type { World } from "@/lib/lab-engine/terminal/types";
import type { Rng } from "./rng";
import { filesPerms } from "./terminal/files-perms";
import { firstTerminal } from "./terminal/first-terminal";
import { r0Challenge } from "./terminal/r0-challenge";

export type GeneratorOutput = { world: World; answers: Record<string, string> };

// Params come from lab.yaml, so generators validate what they read.
export type Generator = (rng: Rng, params: Record<string, unknown>) => GeneratorOutput;

/** Registered by name; lab.yaml `dataset.generator` picks one. */
export const GENERATORS: Record<string, Generator> = {
  files_perms: filesPerms,
  first_terminal: firstTerminal,
  r0_challenge: r0Challenge,
};

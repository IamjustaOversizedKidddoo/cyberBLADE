import "server-only";
/**
 * The ONE dataset a learner investigates for an attempt: server queries and question reference
 * answers both use it, so the answers are always findable with the learner's own queries.
 * Built from the attempt-pinned seed, which never leaves the server.
 */
import type { SocScenario } from "../schema";
import { generateScenarioDataset, type ScenarioDataset } from "./dataset-generator";

export const INVESTIGATION_DATASET_SIZE = 5000;

export function investigationDataset(scenario: SocScenario, seed: string): ScenarioDataset {
  return generateScenarioDataset(scenario, seed, INVESTIGATION_DATASET_SIZE);
}

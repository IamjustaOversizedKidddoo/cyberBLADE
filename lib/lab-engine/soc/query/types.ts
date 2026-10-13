/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Execution Types, Budget Limits & Result Interfaces
 */

import type { BladeQLWarning } from "./errors";

export interface BladeQLBudgets {
  maxQueryLength: number; // default: 4,000
  maxPipelineStages: number; // default: 25
  maxSubsearchDepth: number; // default: 1
  maxEventsScanned: number; // default: 200,000
  maxIntermediateRows: number; // default: 50,000
  maxResultRows: number; // default: 10,000
  maxDistinctGroupKeys: number; // default: 5,000
  maxExecutionSteps: number; // default: 500,000
  maxWallClockSafetyMs: number; // default: 2,000
}

export const DEFAULT_BLADEQL_BUDGETS: BladeQLBudgets = {
  maxQueryLength: 4000,
  maxPipelineStages: 25,
  maxSubsearchDepth: 1,
  maxEventsScanned: 200000,
  maxIntermediateRows: 50000,
  maxResultRows: 10000,
  maxDistinctGroupKeys: 5000,
  maxExecutionSteps: 500000,
  maxWallClockSafetyMs: 2000,
};

export type BladeQLEvent = Record<string, string | number | boolean | null | undefined>;

export interface StaticAssetContext {
  assets?: Array<{
    hostname: string;
    ip: string;
    owner?: string;
    department?: string;
    criticality?: string;
    zone?: string;
  }>;
  identities?: Array<{
    username: string;
    displayName?: string;
    department?: string;
    role?: string;
  }>;
}

export interface QueryExecutionContext {
  attemptId?: string;
  scenarioNowEpochMs: number;
  timeRange?: {
    earliestEpochMs?: number;
    latestEpochMs?: number;
  };
  budgets?: Partial<BladeQLBudgets>;
  contextTables?: StaticAssetContext;
  subsearchExecutor?: (subQuery: string, depth: number) => Promise<BladeQLEvent[]>;
  currentSubsearchDepth?: number;
}

export interface QueryExecutionResult {
  events: BladeQLEvent[];
  fields: string[];
  totalScanned: number;
  totalMatched: number;
  truncated: boolean;
  executionSteps: number;
  executionDurationMs: number;
  warnings: BladeQLWarning[];
  languageVersion: string;
}

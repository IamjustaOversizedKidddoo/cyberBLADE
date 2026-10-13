/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Top-Level Unified Execution Engine
 */

import { Parser } from "./parser";
import { QueryPlanner } from "./planner";
import { BladeQLInterpreter } from "./interpreter";
import { BladeQLError } from "./errors";
import type { BladeQLEvent, QueryExecutionContext, QueryExecutionResult } from "./types";
import { DEFAULT_BLADEQL_BUDGETS } from "./types";

export function executeBladeQL(
  query: string,
  events: BladeQLEvent[],
  ctx?: Partial<QueryExecutionContext>,
): QueryExecutionResult {
  const fullCtx: QueryExecutionContext = {
    scenarioNowEpochMs: ctx?.scenarioNowEpochMs ?? Date.now(),
    budgets: { ...DEFAULT_BLADEQL_BUDGETS, ...(ctx?.budgets ?? {}) },
    ...ctx,
  };

  const budgets = fullCtx.budgets as Required<typeof DEFAULT_BLADEQL_BUDGETS>;
  if (query.length > budgets.maxQueryLength) {
    throw new BladeQLError({
      code: "BUDGET_EXCEEDED",
      message: `Query length (${query.length} characters) exceeds maximum allowed limit of ${budgets.maxQueryLength} characters.`,
    });
  }

  // 1. Parse AST
  const parser = new Parser(query);
  const ast = parser.parse();

  // 2. Validate & Plan
  const planner = new QueryPlanner(fullCtx.budgets as any);
  const plan = planner.plan(ast, query.length);

  // 3. Interpret & Execute
  const interpreter = new BladeQLInterpreter(events, fullCtx);
  const result = interpreter.execute(plan.optimizedAst);

  // Merge plan warnings
  if (plan.warnings.length > 0) {
    result.warnings.unshift(...plan.warnings);
  }

  return result;
}

export * from "./ast";
export * from "./types";
export * from "./errors";
export * from "./lexer";
export * from "./parser";
export * from "./planner";
export * from "./interpreter";
export * from "./safe-regex";
export * from "./spec";

/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Static Validator, Optimization Planner & Warning Generator
 */

import type { PipelineNode } from "./ast";
import type { BladeQLBudgets } from "./types";
import { BladeQLError, type BladeQLWarning } from "./errors";

export interface PlanResult {
  optimizedAst: PipelineNode;
  estimatedCost: "low" | "medium" | "high";
  warnings: BladeQLWarning[];
}

export class QueryPlanner {
  private knownFields?: Set<string>;
  private budgets: BladeQLBudgets;

  constructor(budgets: BladeQLBudgets, knownFields?: string[]) {
    this.budgets = budgets;
    if (knownFields) {
      this.knownFields = new Set(knownFields);
    }
  }

  public plan(ast: PipelineNode, rawQueryLength: number): PlanResult {
    const warnings: BladeQLWarning[] = [];

    // 1. Budget Checks
    if (rawQueryLength > this.budgets.maxQueryLength) {
      throw new BladeQLError({
        code: "BUDGET_EXCEEDED",
        message: `Query length (${rawQueryLength} characters) exceeds maximum allowed limit of ${this.budgets.maxQueryLength} characters.`,
      });
    }

    if (ast.commands.length > this.budgets.maxPipelineStages) {
      throw new BladeQLError({
        code: "BUDGET_EXCEEDED",
        message: `Pipeline stages count (${ast.commands.length}) exceeds maximum limit of ${this.budgets.maxPipelineStages}.`,
      });
    }

    // 2. Field Existence Warnings (Non-fatal)
    if (this.knownFields && this.knownFields.size > 0) {
      this.checkUnknownFields(ast, warnings);
    }

    // 3. Optimizations (e.g. Early Limit / Head)
    const optimizedAst = this.optimize(ast);

    // 4. Estimate Cost
    const hasAgg = ast.commands.some((c) =>
      ["StatsCommand", "TimechartCommand", "EventstatsCommand", "StreamstatsCommand", "JoinCommand"].includes(c.type),
    );
    const estimatedCost = hasAgg ? "medium" : "low";

    return {
      optimizedAst,
      estimatedCost,
      warnings,
    };
  }

  private checkUnknownFields(ast: PipelineNode, warnings: BladeQLWarning[]): void {
    if (!this.knownFields) return;

    // Check base search fields
    const checkTerm = (term: any) => {
      if (!term) return;
      if (term.type === "FieldFilter" && typeof term.field === "string") {
        if (!this.knownFields?.has(term.field) && !term.field.startsWith("_")) {
          warnings.push({
            code: "UNKNOWN_FIELD",
            message: `Field '${term.field}' does not exist on any known telemetry source in this scenario.`,
            loc: term.loc,
          });
        }
      } else if (term.type === "SearchLogical" && Array.isArray(term.operands)) {
        term.operands.forEach(checkTerm);
      }
    };

    if (ast.baseSearch.expression) {
      checkTerm(ast.baseSearch.expression);
    }
  }

  private optimize(ast: PipelineNode): PipelineNode {
    // Clone commands to preserve immutability
    const commands = [...ast.commands];

    // Example optimization: If pipeline is only `table` followed by `head`, keep order
    return {
      ...ast,
      commands,
    };
  }
}

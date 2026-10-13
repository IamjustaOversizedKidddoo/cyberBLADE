/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Error Reporting, Source Caret Formatting & Did-You-Mean Suggestions
 */

import type { SourceLocation } from "./ast";

export type BladeQLErrorCode =
  | "SYNTAX_ERROR"
  | "UNEXPECTED_TOKEN"
  | "UNTERMINATED_STRING"
  | "UNTERMINATED_REGEX"
  | "INVALID_DURATION"
  | "INVALID_IP"
  | "INVALID_COMMAND"
  | "INVALID_FUNCTION"
  | "INVALID_AGGREGATION"
  | "UNKNOWN_FIELD"
  | "TYPE_ERROR"
  | "REGEX_ERROR"
  | "BUDGET_EXCEEDED"
  | "RECURSION_DEPTH_EXCEEDED";

export interface BladeQLWarning {
  code: string;
  message: string;
  loc?: SourceLocation;
}

export class BladeQLError extends Error {
  public readonly code: BladeQLErrorCode;
  public readonly loc?: SourceLocation;
  public readonly suggestion?: string;
  public readonly rawQuery?: string;

  constructor(options: {
    code: BladeQLErrorCode;
    message: string;
    loc?: SourceLocation;
    suggestion?: string;
    rawQuery?: string;
  }) {
    super(options.message);
    this.name = "BladeQLError";
    this.code = options.code;
    this.loc = options.loc;
    this.suggestion = options.suggestion;
    this.rawQuery = options.rawQuery;
  }

  /**
   * Generates a friendly, plain-language error banner with terminal-style caret pointer
   */
  public toFormattedString(): string {
    let out = `[BladeQL Error: ${this.code}] ${this.message}`;

    if (this.loc && this.rawQuery) {
      const lines = this.rawQuery.split(/\r?\n/);
      const errorLine = lines[this.loc.line - 1];
      if (errorLine !== undefined) {
        const lineNumStr = `${this.loc.line} | `;
        out += `\n\n${lineNumStr}${errorLine}`;
        const caretIndent = " ".repeat(lineNumStr.length + Math.max(0, this.loc.column - 1));
        const caretLen = Math.max(1, this.loc.length);
        out += `\n${caretIndent}${"^".repeat(caretLen)}`;
      }
    }

    if (this.suggestion) {
      out += `\n\nSuggestion: ${this.suggestion}`;
    }

    return out;
  }
}

/**
 * Computes Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Finds closest match from a list of known valid candidates
 */
export function findClosestSuggestion(
  input: string,
  candidates: readonly string[] | string[],
  maxDistance = 3,
): string | undefined {
  if (!input) return undefined;
  const target = input.toLowerCase();

  let closest: string | undefined;
  let minDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const dist = levenshteinDistance(target, candidate.toLowerCase());
    if (dist < minDistance) {
      minDistance = dist;
      closest = candidate;
    }
  }

  return closest;
}

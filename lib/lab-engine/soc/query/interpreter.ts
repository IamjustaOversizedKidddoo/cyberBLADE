/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Deterministic In-Memory Pipeline Interpreter with Strict Budgets & Step Counting
 */

import type {
  PipelineNode,
  SearchTerm,
  FieldFilterNode,
  ExpressionNode,
  CommandNode,
  AggregationDefNode,
  SortFieldDef,
  LiteralNode,
} from "./ast";
import type {
  BladeQLEvent,
  QueryExecutionContext,
  QueryExecutionResult,
  BladeQLBudgets,
} from "./types";
import { DEFAULT_BLADEQL_BUDGETS } from "./types";
import { BladeQLError, type BladeQLWarning } from "./errors";
import { SafeRegex } from "./safe-regex";
import { BLADEQL_VERSION } from "./ast";

export class BladeQLInterpreter {
  private events: BladeQLEvent[];
  private ctx: QueryExecutionContext;
  private budgets: BladeQLBudgets;
  private stepCount = 0;
  private startTime = 0;
  private warnings: BladeQLWarning[] = [];

  constructor(events: BladeQLEvent[], ctx: QueryExecutionContext) {
    this.events = events;
    this.ctx = ctx;
    this.budgets = { ...DEFAULT_BLADEQL_BUDGETS, ...(ctx.budgets ?? {}) };
  }

  public execute(ast: PipelineNode): QueryExecutionResult {
    this.stepCount = 0;
    this.startTime = Date.now();
    this.warnings = [];

    // 1. Execute Base Search
    let stream = this.executeBaseSearch(ast.baseSearch);

    // 2. Execute Piped Commands
    for (const cmd of ast.commands) {
      this.checkBudgets();
      stream = this.executeCommand(cmd, stream);
    }

    // 3. Format Output
    let truncated = false;
    if (stream.length > this.budgets.maxResultRows) {
      stream = stream.slice(0, this.budgets.maxResultRows);
      truncated = true;
    }

    const fieldSet = new Set<string>();
    for (const row of stream) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith("__")) {
          fieldSet.add(key);
        }
      }
    }

    const duration = Date.now() - this.startTime;

    return {
      events: stream,
      fields: Array.from(fieldSet),
      totalScanned: Math.min(this.events.length, this.budgets.maxEventsScanned),
      totalMatched: stream.length,
      truncated,
      executionSteps: this.stepCount,
      executionDurationMs: duration,
      warnings: this.warnings,
      languageVersion: BLADEQL_VERSION,
    };
  }

  private checkBudgets(): void {
    this.stepCount++;
    if (this.stepCount > this.budgets.maxExecutionSteps) {
      throw new BladeQLError({
        code: "BUDGET_EXCEEDED",
        message: `Execution step limit exceeded (${this.budgets.maxExecutionSteps} steps). Please narrow your search filters.`,
      });
    }

    if (Date.now() - this.startTime > this.budgets.maxWallClockSafetyMs) {
      throw new BladeQLError({
        code: "BUDGET_EXCEEDED",
        message: `Query execution timed out (${this.budgets.maxWallClockSafetyMs}ms safety limit exceeded).`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Base Search Execution
  // ---------------------------------------------------------------------------

  private executeBaseSearch(baseSearch: PipelineNode["baseSearch"]): BladeQLEvent[] {
    const results: BladeQLEvent[] = [];
    const maxScan = this.budgets.maxEventsScanned;

    // Time window bounds
    let earliestEpoch = this.ctx.timeRange?.earliestEpochMs;
    let latestEpoch = this.ctx.timeRange?.latestEpochMs ?? this.ctx.scenarioNowEpochMs;

    if (baseSearch.timeRange?.earliest) {
      earliestEpoch = this.parseTimeSpec(baseSearch.timeRange.earliest);
    }
    if (baseSearch.timeRange?.latest) {
      latestEpoch = this.parseTimeSpec(baseSearch.timeRange.latest);
    }

    for (let i = 0; i < this.events.length && i < maxScan; i++) {
      this.checkBudgets();
      const row = this.events[i];

      // Time range check
      if (row.timestamp) {
        const rowTime = new Date(String(row.timestamp)).getTime();
        if (!isNaN(rowTime)) {
          if (earliestEpoch !== undefined && rowTime < earliestEpoch) continue;
          if (latestEpoch !== undefined && rowTime > latestEpoch) continue;
        }
      }

      // Filter check
      if (baseSearch.expression) {
        if (!this.evaluateSearchTerm(baseSearch.expression, row)) {
          continue;
        }
      }

      results.push(this.cloneRow(row));

      if (results.length > this.budgets.maxIntermediateRows) {
        throw new BladeQLError({
          code: "BUDGET_EXCEEDED",
          message: `Intermediate result limit exceeded (${this.budgets.maxIntermediateRows} rows). Add more specific filters.`,
        });
      }
    }

    return results;
  }

  private parseTimeSpec(val: string | number): number {
    if (typeof val === "number") return val;
    const str = val.trim();

    if (str.startsWith("-")) {
      const durMs = this.parseDurationMs(str.slice(1));
      return this.ctx.scenarioNowEpochMs - durMs;
    }
    if (str.startsWith("+")) {
      const durMs = this.parseDurationMs(str.slice(1));
      return this.ctx.scenarioNowEpochMs + durMs;
    }
    if (str === "@now" || str === "now") {
      return this.ctx.scenarioNowEpochMs;
    }

    const parsed = new Date(str).getTime();
    if (!isNaN(parsed)) return parsed;

    return this.ctx.scenarioNowEpochMs;
  }

  private parseDurationMs(durStr: string): number {
    const match = durStr.match(/^(\d+)([smhdw])$/i);
    if (!match) return 0;
    const count = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "s":
        return count * 1000;
      case "m":
        return count * 60 * 1000;
      case "h":
        return count * 60 * 60 * 1000;
      case "d":
        return count * 24 * 60 * 60 * 1000;
      case "w":
        return count * 7 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  private evaluateSearchTerm(term: SearchTerm, row: BladeQLEvent): boolean {
    this.checkBudgets();

    if (term.type === "KeywordSearch") {
      const needle = String(term.value).toLowerCase();
      if (term.isWildcard) {
        const regexStr = "^" + needle.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
        const rx = new SafeRegex(regexStr, "i");
        for (const [k, v] of Object.entries(row)) {
          if (k.startsWith("__") || v === null || v === undefined) continue;
          if (rx.test(String(v))) return true;
        }
        return false;
      }
      for (const [k, v] of Object.entries(row)) {
        if (k.startsWith("__") || v === null || v === undefined) continue;
        if (String(v).toLowerCase().includes(needle)) return true;
      }
      return false;
    }

    if (term.type === "FieldFilter") {
      return this.evaluateFieldFilter(term, row);
    }

    if (term.type === "SearchLogical") {
      if (term.operator === "AND") {
        return term.operands.every((op) => this.evaluateSearchTerm(op, row));
      }
      if (term.operator === "OR") {
        return term.operands.some((op) => this.evaluateSearchTerm(op, row));
      }
      if (term.operator === "NOT") {
        return !this.evaluateSearchTerm(term.operands[0], row);
      }
    }

    return true;
  }

  private evaluateFieldFilter(filter: FieldFilterNode, row: BladeQLEvent): boolean {
    const rawVal = row[filter.field];
    const targetVal = filter.value;

    if (filter.operator === "in") {
      if (!Array.isArray(targetVal)) return false;
      const strRowVal = String(rawVal ?? "").toLowerCase();
      return targetVal.some((item) => {
        const itemVal = String(item.value ?? "");
        if (item.valueType === "cidr" || itemVal.includes("/")) {
          return this.cidrMatch(strRowVal, itemVal);
        }
        return itemVal.toLowerCase() === strRowVal;
      });
    }

    if (Array.isArray(targetVal)) return false;

    // Wildcard filter
    if (targetVal.type === "Wildcard") {
      const pattern = targetVal.pattern;
      const regexStr = "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
      const rx = new SafeRegex(regexStr, "i");
      const matched = rx.test(String(rawVal ?? ""));
      return filter.operator === "!=" ? !matched : matched;
    }

    const lit = targetVal as LiteralNode;

    // CIDR match filter
    if (filter.operator === "cidrmatch" || (filter.operator === "==" && lit.valueType === "cidr")) {
      const ip = String(rawVal ?? "");
      const cidr = String(lit.value ?? "");
      return this.cidrMatch(ip, cidr);
    }

    if (typeof lit.value === "string" && (lit.value.includes("*") || lit.value.includes("?"))) {
      const pattern = lit.value;
      const regexStr = "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
      const rx = new SafeRegex(regexStr, "i");
      const matched = rx.test(String(rawVal ?? ""));
      return filter.operator === "!=" ? !matched : matched;
    }

    const rowValStr = String(rawVal ?? "").toLowerCase();
    const targetValStr = String(lit.value ?? "").toLowerCase();

    switch (filter.operator) {
      case "==":
      case "=":
        if (typeof rawVal === "number" && typeof lit.value === "number") {
          return rawVal === lit.value;
        }
        return rowValStr === targetValStr;

      case "!=":
        if (typeof rawVal === "number" && typeof lit.value === "number") {
          return rawVal !== lit.value;
        }
        return rowValStr !== targetValStr;

      case "===":
        return String(rawVal ?? "") === String(lit.value ?? "");

      case "<":
        return Number(rawVal) < Number(lit.value);
      case "<=":
        return Number(rawVal) <= Number(lit.value);
      case ">":
        return Number(rawVal) > Number(lit.value);
      case ">=":
        return Number(rawVal) >= Number(lit.value);

      case "=~": {
        const rx = new SafeRegex(String(targetVal.value), "i");
        return rx.test(String(rawVal ?? ""));
      }
      case "!~": {
        const rx = new SafeRegex(String(targetVal.value), "i");
        return !rx.test(String(rawVal ?? ""));
      }
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Piped Commands Execution
  // ---------------------------------------------------------------------------

  private executeCommand(cmd: CommandNode, rows: BladeQLEvent[]): BladeQLEvent[] {
    switch (cmd.type) {
      case "WhereCommand": {
        return rows.filter((row) => {
          this.checkBudgets();
          const res = this.evaluateExpression(cmd.predicate, row);
          return Boolean(res);
        });
      }

      case "SearchCommand": {
        return rows.filter((row) => {
          this.checkBudgets();
          return this.evaluateSearchTerm(cmd.expression, row);
        });
      }

      case "FieldsCommand": {
        const fieldSet = new Set(cmd.fields);
        return rows.map((row) => {
          this.checkBudgets();
          const newRow = Object.create(null);
          if (cmd.mode === "include") {
            for (const f of cmd.fields) {
              if (f in row) newRow[f] = row[f];
            }
          } else {
            for (const [k, v] of Object.entries(row)) {
              if (!fieldSet.has(k)) newRow[k] = v;
            }
          }
          return newRow;
        });
      }

      case "TableCommand": {
        return rows.map((row) => {
          this.checkBudgets();
          const newRow = Object.create(null);
          for (const f of cmd.fields) {
            newRow[f] = row[f] !== undefined ? row[f] : null;
          }
          return newRow;
        });
      }

      case "RenameCommand": {
        return rows.map((row) => {
          this.checkBudgets();
          const newRow = { ...row };
          for (const m of cmd.mappings) {
            if (m.from in newRow) {
              newRow[m.to] = newRow[m.from];
              delete newRow[m.from];
            }
          }
          return newRow;
        });
      }

      case "HeadCommand": {
        return rows.slice(0, Math.max(0, cmd.count));
      }

      case "TailCommand": {
        const n = Math.max(0, cmd.count);
        return rows.slice(Math.max(0, rows.length - n));
      }

      case "DedupCommand": {
        const seen = new Set<string>();
        return rows.filter((row) => {
          this.checkBudgets();
          const key = cmd.fields.map((f) => String(row[f] ?? "")).join("||");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      case "SortCommand": {
        const sorted = [...rows];
        sorted.sort((a, b) => this.compareRows(a, b, cmd.fields));
        return sorted;
      }

      case "EvalCommand": {
        return rows.map((row) => {
          this.checkBudgets();
          const newRow = { ...row };
          for (const assign of cmd.assignments) {
            // Ignore prototype polluting keys
            if (assign.target === "__proto__" || assign.target === "constructor" || assign.target === "prototype") {
              continue;
            }
            newRow[assign.target] = this.evaluateExpression(assign.expression, newRow);
          }
          return newRow;
        });
      }

      case "StatsCommand": {
        return this.executeStats(cmd, rows);
      }

      case "TopCommand": {
        return this.executeTopOrRare(cmd.field, cmd.byField, cmd.limit, rows, "top");
      }

      case "RareCommand": {
        return this.executeTopOrRare(cmd.field, cmd.byField, cmd.limit, rows, "rare");
      }

      case "TimechartCommand": {
        return this.executeTimechart(cmd, rows);
      }

      case "BucketCommand": {
        const spanMs = this.parseDurationMs(cmd.span);
        const targetField = cmd.alias ?? cmd.field;
        return rows.map((row) => {
          this.checkBudgets();
          const val = row[cmd.field];
          if (!val) return row;
          const time = new Date(String(val)).getTime();
          if (isNaN(time)) return row;
          const bucketTime = Math.floor(time / spanMs) * spanMs;
          return {
            ...row,
            [targetField]: new Date(bucketTime).toISOString(),
          };
        });
      }

      case "SessionCommand": {
        return this.executeSession(cmd, rows);
      }

      case "EventstatsCommand": {
        return this.executeEventstats(cmd, rows);
      }

      case "StreamstatsCommand": {
        return this.executeStreamstats(cmd, rows);
      }

      case "ParseCommand": {
        return this.executeParse(cmd, rows);
      }

      case "ExtractCommand": {
        const rx = new SafeRegex(cmd.regex, cmd.flags ?? "i");
        return rows.map((row) => {
          this.checkBudgets();
          const text = String(row[cmd.fromField] ?? "");
          const match = rx.exec(text);
          if (!match) return row;
          return {
            ...row,
            ...match.groups,
          };
        });
      }

      case "UnionCommand": {
        const subInterpreter = new BladeQLInterpreter(this.events, {
          ...this.ctx,
          currentSubsearchDepth: (this.ctx.currentSubsearchDepth ?? 0) + 1,
        });
        const subRes = subInterpreter.execute(cmd.pipeline);
        return [...rows, ...subRes.events];
      }

      case "JoinCommand": {
        const subInterpreter = new BladeQLInterpreter(this.events, {
          ...this.ctx,
          currentSubsearchDepth: (this.ctx.currentSubsearchDepth ?? 0) + 1,
        });
        const subRes = subInterpreter.execute(cmd.pipeline);
        const subMap = new Map<string, BladeQLEvent>();

        for (const subRow of subRes.events) {
          const k = String(subRow[cmd.joinKey] ?? "");
          if (k && !subMap.has(k)) {
            subMap.set(k, subRow);
          }
        }

        const out: BladeQLEvent[] = [];
        for (const row of rows) {
          this.checkBudgets();
          const k = String(row[cmd.joinKey] ?? "");
          const match = subMap.get(k);
          if (match) {
            out.push({ ...row, ...match });
          } else if (cmd.joinType === "left") {
            out.push({ ...row });
          }
        }
        return out;
      }

      case "LookupCommand": {
        return this.executeLookup(cmd, rows);
      }

      default:
        return rows;
    }
  }

  // ---------------------------------------------------------------------------
  // Expression Evaluator (eval & where)
  // ---------------------------------------------------------------------------

  private evaluateExpression(expr: ExpressionNode, row: BladeQLEvent): any {
    this.checkBudgets();

    if (expr.type === "Literal") {
      return expr.value;
    }

    if (expr.type === "Identifier") {
      return row[expr.name] ?? null;
    }

    if (expr.type === "UnaryExpression") {
      const val = this.evaluateExpression(expr.argument, row);
      if (expr.operator === "not" || expr.operator === "!") return !val;
      if (expr.operator === "-") return -Number(val);
      if (expr.operator === "+") return +Number(val);
      return val;
    }

    if (expr.type === "BinaryExpression") {
      const left = this.evaluateExpression(expr.left, row);
      const right = this.evaluateExpression(expr.right, row);

      switch (expr.operator) {
        case "+":
          if (typeof left === "string" || typeof right === "string") {
            return String(left ?? "") + String(right ?? "");
          }
          return Number(left) + Number(right);
        case "-":
          return Number(left) - Number(right);
        case "*":
          return Number(left) * Number(right);
        case "/":
          return Number(right) === 0 ? null : Number(left) / Number(right);
        case "%":
          return Number(left) % Number(right);

        case "==":
        case "=":
          if (typeof left === "number" && typeof right === "number") return left === right;
          return String(left ?? "").toLowerCase() === String(right ?? "").toLowerCase();

        case "===":
          return left === right;

        case "!=":
          if (typeof left === "number" && typeof right === "number") return left !== right;
          return String(left ?? "").toLowerCase() !== String(right ?? "").toLowerCase();

        case "<":
          return Number(left) < Number(right);
        case "<=":
          return Number(left) <= Number(right);
        case ">":
          return Number(left) > Number(right);
        case ">=":
          return Number(left) >= Number(right);

        case "=~": {
          const rx = new SafeRegex(String(right), "i");
          return rx.test(String(left ?? ""));
        }
        case "!~": {
          const rx = new SafeRegex(String(right), "i");
          return !rx.test(String(left ?? ""));
        }

        case "and":
          return Boolean(left) && Boolean(right);
        case "or":
          return Boolean(left) || Boolean(right);

        default:
          return null;
      }
    }

    if (expr.type === "FunctionCall") {
      return this.evaluateFunction(expr.name, expr.arguments, row);
    }

    return null;
  }

  private evaluateFunction(name: string, args: ExpressionNode[], row: BladeQLEvent): any {
    const fn = name.toLowerCase();

    // Short-circuiting functions
    if (fn === "if") {
      const cond = this.evaluateExpression(args[0], row);
      return cond ? this.evaluateExpression(args[1], row) : this.evaluateExpression(args[2], row);
    }

    if (fn === "case") {
      for (let i = 0; i < args.length - 1; i += 2) {
        if (this.evaluateExpression(args[i], row)) {
          return this.evaluateExpression(args[i + 1], row);
        }
      }
      return args.length % 2 === 1 ? this.evaluateExpression(args[args.length - 1], row) : null;
    }

    if (fn === "coalesce") {
      for (const arg of args) {
        const val = this.evaluateExpression(arg, row);
        if (val !== null && val !== undefined) return val;
      }
      return null;
    }

    // Standard evaluated arguments
    const evaluated = args.map((a) => this.evaluateExpression(a, row));

    switch (fn) {
      case "isnull":
        return evaluated[0] === null || evaluated[0] === undefined;
      case "isnotnull":
        return evaluated[0] !== null && evaluated[0] !== undefined;
      case "lower":
        return String(evaluated[0] ?? "").toLowerCase();
      case "upper":
        return String(evaluated[0] ?? "").toUpperCase();
      case "len":
        return String(evaluated[0] ?? "").length;
      case "substr": {
        const str = String(evaluated[0] ?? "");
        const start = Math.max(0, parseInt(evaluated[1], 10) - 1); // 1-indexed
        const length = evaluated[2] !== undefined ? parseInt(evaluated[2], 10) : undefined;
        return length !== undefined ? str.substring(start, start + length) : str.substring(start);
      }
      case "replace": {
        const str = String(evaluated[0] ?? "");
        const target = String(evaluated[1] ?? "");
        const repl = String(evaluated[2] ?? "");
        return str.replaceAll(target, repl);
      }
      case "split":
        return String(evaluated[0] ?? "").split(String(evaluated[1] ?? ","));
      case "trim":
        return String(evaluated[0] ?? "").trim();
      case "contains":
        return String(evaluated[0] ?? "").toLowerCase().includes(String(evaluated[1] ?? "").toLowerCase());
      case "startswith":
        return String(evaluated[0] ?? "").toLowerCase().startsWith(String(evaluated[1] ?? "").toLowerCase());
      case "endswith":
        return String(evaluated[0] ?? "").toLowerCase().endsWith(String(evaluated[1] ?? "").toLowerCase());
      case "concat":
        return evaluated.map((v) => String(v ?? "")).join("");

      case "tonumber": {
        const n = Number(evaluated[0]);
        return isNaN(n) ? null : n;
      }
      case "tostring":
        return String(evaluated[0] ?? "");
      case "round": {
        const n = Number(evaluated[0]);
        const dec = evaluated[1] !== undefined ? parseInt(evaluated[1], 10) : 0;
        const factor = Math.pow(10, dec);
        return Math.round(n * factor) / factor;
      }
      case "floor":
        return Math.floor(Number(evaluated[0]));
      case "ceil":
        return Math.ceil(Number(evaluated[0]));
      case "abs":
        return Math.abs(Number(evaluated[0]));

      case "now":
        return this.ctx.scenarioNowEpochMs;

      case "strftime": {
        const d = new Date(evaluated[0]);
        if (isNaN(d.getTime())) return null;
        let fmt = String(evaluated[1] ?? "%Y-%m-%d %H:%M:%S");
        fmt = fmt.replace("%Y", d.getUTCFullYear().toString());
        fmt = fmt.replace("%m", (d.getUTCMonth() + 1).toString().padStart(2, "0"));
        fmt = fmt.replace("%d", d.getUTCDate().toString().padStart(2, "0"));
        fmt = fmt.replace("%H", d.getUTCHours().toString().padStart(2, "0"));
        fmt = fmt.replace("%M", d.getUTCMinutes().toString().padStart(2, "0"));
        fmt = fmt.replace("%S", d.getUTCSeconds().toString().padStart(2, "0"));
        return fmt;
      }

      case "strptime": {
        const d = new Date(String(evaluated[0]));
        return isNaN(d.getTime()) ? null : d.getTime();
      }

      case "time_diff": {
        const t1 = new Date(evaluated[0]).getTime();
        const t2 = new Date(evaluated[1]).getTime();
        const unit = String(evaluated[2] ?? "s").toLowerCase();
        const diffMs = t1 - t2;
        if (unit === "m") return Math.round(diffMs / 60000);
        if (unit === "h") return Math.round(diffMs / 3600000);
        if (unit === "d") return Math.round(diffMs / 86400000);
        return Math.round(diffMs / 1000);
      }

      case "relative_time": {
        const t = new Date(evaluated[0]).getTime();
        const offset = this.parseDurationMs(String(evaluated[1]).replace(/^[+-]/, ""));
        const sign = String(evaluated[1]).startsWith("-") ? -1 : 1;
        return new Date(t + sign * offset).toISOString();
      }

      case "cidrmatch":
        return this.cidrMatch(String(evaluated[0] ?? ""), String(evaluated[1] ?? ""));

      case "is_private":
        return this.isPrivateIp(String(evaluated[0] ?? ""));

      case "defang":
        return String(evaluated[0] ?? "")
          .replace(/http:\/\//gi, "hxxp://")
          .replace(/https:\/\//gi, "hxxps://")
          .replace(/\./g, "[.]");

      case "refang":
        return String(evaluated[0] ?? "")
          .replace(/hxxps:\/\//gi, "https://")
          .replace(/hxxp:\/\//gi, "http://")
          .replace(/\[\.\]/g, ".");

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Aggregation & Stats Execution
  // ---------------------------------------------------------------------------

  private executeStats(cmd: CommandNode & { type: "StatsCommand" }, rows: BladeQLEvent[]): BladeQLEvent[] {
    const groups = new Map<string, { keyRow: BladeQLEvent; rows: BladeQLEvent[] }>();

    for (const row of rows) {
      this.checkBudgets();
      const groupKey = cmd.byFields.map((f) => String(row[f] ?? "")).join("||");

      let group = groups.get(groupKey);
      if (!group) {
        if (groups.size >= this.budgets.maxDistinctGroupKeys) {
          throw new BladeQLError({
            code: "BUDGET_EXCEEDED",
            message: `Maximum distinct grouping keys limit (${this.budgets.maxDistinctGroupKeys}) exceeded. Narrow your query.`,
          });
        }
        const keyRow = Object.create(null);
        for (const f of cmd.byFields) {
          keyRow[f] = row[f] !== undefined ? row[f] : null;
        }
        group = { keyRow, rows: [] };
        groups.set(groupKey, group);
      }
      group.rows.push(row);
    }

    // Compute aggregations per group
    const out: BladeQLEvent[] = [];

    // If no rows and no 'by' fields, return 1 row with count=0
    if (groups.size === 0 && cmd.byFields.length === 0) {
      const singleRow = Object.create(null);
      for (const agg of cmd.aggregations) {
        const alias = agg.alias ?? `${agg.func}${agg.field ? `_${agg.field}` : ""}`;
        singleRow[alias] = agg.func === "count" ? 0 : null;
      }
      return [singleRow];
    }

    for (const group of groups.values()) {
      this.checkBudgets();
      const resultRow = { ...group.keyRow };

      for (const agg of cmd.aggregations) {
        const alias = agg.alias ?? `${agg.func}${agg.field ? `_${agg.field}` : ""}`;
        resultRow[alias] = this.computeAggregation(agg, group.rows);
      }

      out.push(resultRow);
    }

    return out;
  }

  private computeAggregation(agg: AggregationDefNode, rows: BladeQLEvent[]): any {
    const field = agg.field;

    switch (agg.func) {
      case "count":
        return rows.length;

      case "dc": {
        if (!field) return 0;
        const set = new Set<string>();
        for (const r of rows) {
          if (r[field] !== null && r[field] !== undefined) set.add(String(r[field]));
        }
        return set.size;
      }

      case "sum": {
        if (!field) return 0;
        let sum = 0;
        for (const r of rows) sum += Number(r[field]) || 0;
        return sum;
      }

      case "avg": {
        if (!field || rows.length === 0) return 0;
        let sum = 0;
        let count = 0;
        for (const r of rows) {
          if (r[field] !== null && r[field] !== undefined && !isNaN(Number(r[field]))) {
            sum += Number(r[field]);
            count++;
          }
        }
        return count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      }

      case "min": {
        if (!field || rows.length === 0) return null;
        let minVal: number | null = null;
        for (const r of rows) {
          const n = Number(r[field]);
          if (!isNaN(n)) minVal = minVal === null ? n : Math.min(minVal, n);
        }
        return minVal;
      }

      case "max": {
        if (!field || rows.length === 0) return null;
        let maxVal: number | null = null;
        for (const r of rows) {
          const n = Number(r[field]);
          if (!isNaN(n)) maxVal = maxVal === null ? n : Math.max(maxVal, n);
        }
        return maxVal;
      }

      case "median": {
        if (!field || rows.length === 0) return null;
        const nums = rows.map((r) => Number(r[field])).filter((n) => !isNaN(n)).sort((a, b) => a - b);
        if (nums.length === 0) return null;
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }

      case "stdev": {
        if (!field || rows.length < 2) return 0;
        const nums = rows.map((r) => Number(r[field])).filter((n) => !isNaN(n));
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (nums.length - 1);
        return Math.round(Math.sqrt(variance) * 100) / 100;
      }

      case "values": {
        if (!field) return [];
        const set = new Set<string>();
        for (const r of rows) {
          if (r[field] !== null && r[field] !== undefined) {
            set.add(String(r[field]));
            if (set.size >= 100) break; // bounded
          }
        }
        return Array.from(set);
      }

      case "list": {
        if (!field) return [];
        const list: any[] = [];
        for (const r of rows) {
          if (r[field] !== null && r[field] !== undefined) {
            list.push(r[field]);
            if (list.length >= 50) break; // bounded
          }
        }
        return list;
      }

      case "first":
        return field && rows[0] ? rows[0][field] ?? null : null;

      case "last":
        return field && rows[rows.length - 1] ? rows[rows.length - 1][field] ?? null : null;

      case "earliest":
      case "latest":
        return field && rows[0] ? rows[0][field] ?? null : null;

      default:
        return null;
    }
  }

  private executeTopOrRare(
    field: string,
    byField: string | undefined,
    limit: number,
    rows: BladeQLEvent[],
    mode: "top" | "rare",
  ): BladeQLEvent[] {
    const counts = new Map<string, number>();
    const total = rows.length;

    for (const r of rows) {
      this.checkBudgets();
      const val = String(r[field] ?? "");
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }

    const items = Array.from(counts.entries()).map(([val, count]) => ({
      [field]: val,
      count,
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

    if (mode === "top") {
      items.sort((a, b) => b.count - a.count);
    } else {
      items.sort((a, b) => a.count - b.count);
    }

    return items.slice(0, Math.max(1, limit));
  }

  private executeTimechart(
    cmd: CommandNode & { type: "TimechartCommand" },
    rows: BladeQLEvent[],
  ): BladeQLEvent[] {
    const spanMs = this.parseDurationMs(cmd.span);
    const timeBuckets = new Map<number, BladeQLEvent[]>();

    for (const row of rows) {
      this.checkBudgets();
      if (!row.timestamp) continue;
      const t = new Date(String(row.timestamp)).getTime();
      if (isNaN(t)) continue;
      const bucket = Math.floor(t / spanMs) * spanMs;

      let list = timeBuckets.get(bucket);
      if (!list) {
        list = [];
        timeBuckets.set(bucket, list);
      }
      list.push(row);
    }

    const sortedBuckets = Array.from(timeBuckets.keys()).sort((a, b) => a - b);
    const out: BladeQLEvent[] = [];

    for (const bTime of sortedBuckets) {
      this.checkBudgets();
      const bRows = timeBuckets.get(bTime)!;
      const row: BladeQLEvent = {
        _time: new Date(bTime).toISOString(),
      };

      if (cmd.byField) {
        // Group by facet
        const facetGroups = new Map<string, BladeQLEvent[]>();
        for (const r of bRows) {
          const facetVal = String(r[cmd.byField] ?? "null");
          let fList = facetGroups.get(facetVal);
          if (!fList) {
            fList = [];
            facetGroups.set(facetVal, fList);
          }
          fList.push(r);
        }
        for (const [facetVal, fRows] of facetGroups.entries()) {
          row[facetVal] = fRows.length;
        }
      } else {
        for (const agg of cmd.aggregations) {
          const alias = agg.alias ?? `${agg.func}${agg.field ? `_${agg.field}` : ""}`;
          row[alias] = this.computeAggregation(agg, bRows);
        }
      }

      out.push(row);
    }

    return out;
  }

  private executeSession(
    cmd: CommandNode & { type: "SessionCommand" },
    rows: BladeQLEvent[],
  ): BladeQLEvent[] {
    const maxGapMs = this.parseDurationMs(cmd.maxGap);
    // Sort rows by entity then time
    const sorted = [...rows].sort((a, b) => {
      const keyDiff = String(a[cmd.byField] ?? "").localeCompare(String(b[cmd.byField] ?? ""));
      if (keyDiff !== 0) return keyDiff;
      return new Date(String(a.timestamp)).getTime() - new Date(String(b.timestamp)).getTime();
    });

    const sessions: BladeQLEvent[] = [];
    let curEntity: string | null = null;
    let sessStart = 0;
    let sessEnd = 0;
    let sessCount = 0;
    let sessId = 1;

    for (const r of sorted) {
      this.checkBudgets();
      const entity = String(r[cmd.byField] ?? "");
      const time = new Date(String(r.timestamp)).getTime();
      if (isNaN(time)) continue;

      if (entity !== curEntity || time - sessEnd > maxGapMs) {
        if (curEntity !== null) {
          sessions.push({
            [cmd.byField]: curEntity,
            session_id: `sess-${sessId++}`,
            session_start: new Date(sessStart).toISOString(),
            session_end: new Date(sessEnd).toISOString(),
            session_duration_sec: Math.round((sessEnd - sessStart) / 1000),
            event_count: sessCount,
          });
        }
        curEntity = entity;
        sessStart = time;
        sessEnd = time;
        sessCount = 1;
      } else {
        sessEnd = time;
        sessCount++;
      }
    }

    if (curEntity !== null) {
      sessions.push({
        [cmd.byField]: curEntity,
        session_id: `sess-${sessId++}`,
        session_start: new Date(sessStart).toISOString(),
        session_end: new Date(sessEnd).toISOString(),
        session_duration_sec: Math.round((sessEnd - sessStart) / 1000),
        event_count: sessCount,
      });
    }

    return sessions;
  }

  private executeEventstats(
    cmd: CommandNode & { type: "EventstatsCommand" },
    rows: BladeQLEvent[],
  ): BladeQLEvent[] {
    const statsResults = this.executeStats({ ...cmd, type: "StatsCommand" }, rows);
    const statsMap = new Map<string, BladeQLEvent>();

    for (const sRow of statsResults) {
      const key = cmd.byFields.map((f) => String(sRow[f] ?? "")).join("||");
      statsMap.set(key, sRow);
    }

    return rows.map((row) => {
      this.checkBudgets();
      const key = cmd.byFields.map((f) => String(row[f] ?? "")).join("||");
      const statMatch = statsMap.get(key);
      return {
        ...row,
        ...(statMatch ?? {}),
      };
    });
  }

  private executeStreamstats(
    cmd: CommandNode & { type: "StreamstatsCommand" },
    rows: BladeQLEvent[],
  ): BladeQLEvent[] {
    const runningCounts = new Map<string, number>();

    return rows.map((row) => {
      this.checkBudgets();
      const key = cmd.byFields.map((f) => String(row[f] ?? "")).join("||");
      const cur = (runningCounts.get(key) ?? 0) + 1;
      runningCounts.set(key, cur);

      const newRow = { ...row };
      for (const agg of cmd.aggregations) {
        const alias = agg.alias ?? `${agg.func}${agg.field ? `_${agg.field}` : ""}`;
        if (agg.func === "count") {
          newRow[alias] = cur;
        }
      }
      return newRow;
    });
  }

  private executeParse(
    cmd: CommandNode & { type: "ParseCommand" },
    rows: BladeQLEvent[],
  ): BladeQLEvent[] {
    // Convert template with '*' into a capture regex
    let rxStr = "^";
    let targetIdx = 0;
    const parts = cmd.template.split("*");

    for (let i = 0; i < parts.length; i++) {
      rxStr += parts[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (i < parts.length - 1) {
        const fieldName = cmd.targetFields[targetIdx++] ?? `parsed_${targetIdx}`;
        rxStr += `(?<${fieldName}>.*?)`;
      }
    }
    rxStr += "$";

    const rx = new SafeRegex(rxStr, "i");

    return rows.map((row) => {
      this.checkBudgets();
      const text = String(row[cmd.fromField] ?? "");
      const match = rx.exec(text);
      if (!match) return row;
      return {
        ...row,
        ...match.groups,
      };
    });
  }

  private executeLookup(
    cmd: CommandNode & { type: "LookupCommand" },
    rows: BladeQLEvent[],
  ): BladeQLEvent[] {
    const assets = this.ctx.contextTables?.assets ?? [];
    const identities = this.ctx.contextTables?.identities ?? [];

    return rows.map((row) => {
      this.checkBudgets();
      const keyVal = String(row[cmd.field] ?? "");
      if (cmd.table === "assets") {
        const matched = assets.find((a) => a.hostname === keyVal || a.ip === keyVal);
        if (matched) {
          return {
            ...row,
            asset_owner: matched.owner ?? null,
            asset_department: matched.department ?? null,
            asset_criticality: matched.criticality ?? null,
            asset_zone: matched.zone ?? null,
          };
        }
      } else if (cmd.table === "identities") {
        const matched = identities.find((u) => u.username === keyVal);
        if (matched) {
          return {
            ...row,
            user_display_name: matched.displayName ?? null,
            user_department: matched.department ?? null,
            user_role: matched.role ?? null,
          };
        }
      }
      return row;
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers: Sorting, CIDR, Cloning
  // ---------------------------------------------------------------------------

  private compareRows(a: BladeQLEvent, b: BladeQLEvent, fields: SortFieldDef[]): number {
    for (const f of fields) {
      const valA = a[f.field];
      const valB = b[f.field];

      if (valA === valB) continue;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let cmp = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }

      if (cmp !== 0) {
        return f.direction === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  }

  private cidrMatch(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split("/");
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;

    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);
    if (ipNum === null || rangeNum === null) return false;

    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split(".");
    if (parts.length !== 4) return null;
    let num = 0;
    for (const p of parts) {
      const b = parseInt(p, 10);
      if (isNaN(b) || b < 0 || b > 255) return null;
      num = ((num << 8) + b) >>> 0;
    }
    return num;
  }

  private isPrivateIp(ip: string): boolean {
    return (
      this.cidrMatch(ip, "10.0.0.0/8") ||
      this.cidrMatch(ip, "172.16.0.0/12") ||
      this.cidrMatch(ip, "192.168.0.0/16")
    );
  }

  private cloneRow(row: BladeQLEvent): BladeQLEvent {
    const out = Object.create(null);
    for (const [k, v] of Object.entries(row)) {
      out[k] = v;
    }
    return out;
  }
}

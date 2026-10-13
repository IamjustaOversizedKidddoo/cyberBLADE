/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Abstract Syntax Tree (AST) & Type System Definitions
 * Version: 1.0.0
 */

export const BLADEQL_VERSION = "1.0.0";

export type SourceLocation = {
  line: number;
  column: number;
  offset: number;
  length: number;
};

// ---------------------------------------------------------------------------
// Base Search & Expressions
// ---------------------------------------------------------------------------

export type ValueLiteralType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "duration"
  | "ip"
  | "cidr"
  | "timestamp";

export type LiteralValue = string | number | boolean | null;

export interface LiteralNode {
  type: "Literal";
  valueType: ValueLiteralType;
  value: LiteralValue;
  raw: string;
  loc?: SourceLocation;
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
  loc?: SourceLocation;
}

export interface WildcardNode {
  type: "Wildcard";
  pattern: string; // e.g. "*admin*" or "ws-*-01"
  loc?: SourceLocation;
}

export type SearchTerm =
  | FieldFilterNode
  | KeywordSearchNode
  | SearchLogicalNode;

export interface KeywordSearchNode {
  type: "KeywordSearch";
  value: string | number;
  isWildcard: boolean;
  loc?: SourceLocation;
}

export type ComparisonOperator =
  | "=="
  | "="
  | "!="
  | "==="
  | "<"
  | "<="
  | ">"
  | ">="
  | "=~" // Regex / pattern match
  | "!~";

export interface FieldFilterNode {
  type: "FieldFilter";
  field: string;
  operator: ComparisonOperator | "in" | "not_in" | "cidrmatch";
  value: LiteralNode | WildcardNode | LiteralNode[];
  loc?: SourceLocation;
}

export interface SearchLogicalNode {
  type: "SearchLogical";
  operator: "AND" | "OR" | "NOT";
  operands: SearchTerm[];
  loc?: SourceLocation;
}

export interface BaseSearchNode {
  type: "BaseSearch";
  expression: SearchTerm | null; // null represents empty search (all events)
  timeRange?: {
    earliest?: string | number; // e.g. "-1h" or ISO string or epoch
    latest?: string | number;
  };
  loc?: SourceLocation;
}

// ---------------------------------------------------------------------------
// General Expressions (used in `eval` and `where`)
// ---------------------------------------------------------------------------

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "="
  | "!="
  | "==="
  | "<"
  | "<="
  | ">"
  | ">="
  | "=~"
  | "!~"
  | "and"
  | "or";

export type UnaryOperator = "+" | "-" | "not" | "!";

export interface BinaryExpressionNode {
  type: "BinaryExpression";
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
  loc?: SourceLocation;
}

export interface UnaryExpressionNode {
  type: "UnaryExpression";
  operator: UnaryOperator;
  argument: ExpressionNode;
  loc?: SourceLocation;
}

export interface FunctionCallNode {
  type: "FunctionCall";
  name: string;
  arguments: ExpressionNode[];
  loc?: SourceLocation;
}

export type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | FunctionCallNode;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type AggregationFunction =
  | "count"
  | "dc"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "stdev"
  | "values"
  | "list"
  | "first"
  | "last"
  | "earliest"
  | "latest";

export interface AggregationDefNode {
  type: "AggregationDef";
  func: AggregationFunction;
  field?: string; // e.g. "bytes_in" (optional for count)
  alias?: string;
  loc?: SourceLocation;
}

export interface WhereCommandNode {
  type: "WhereCommand";
  predicate: ExpressionNode;
  loc?: SourceLocation;
}

export interface SearchCommandNode {
  type: "SearchCommand";
  expression: SearchTerm;
  loc?: SourceLocation;
}

export interface FieldsCommandNode {
  type: "FieldsCommand";
  mode: "include" | "exclude";
  fields: string[];
  loc?: SourceLocation;
}

export interface TableCommandNode {
  type: "TableCommand";
  fields: string[];
  loc?: SourceLocation;
}

export interface RenameCommandNode {
  type: "RenameCommand";
  mappings: Array<{ from: string; to: string }>;
  loc?: SourceLocation;
}

export interface HeadCommandNode {
  type: "HeadCommand";
  count: number;
  loc?: SourceLocation;
}

export interface TailCommandNode {
  type: "TailCommand";
  count: number;
  loc?: SourceLocation;
}

export interface DedupCommandNode {
  type: "DedupCommand";
  fields: string[];
  loc?: SourceLocation;
}

export interface SortFieldDef {
  field: string;
  direction: "asc" | "desc";
  nulls?: "first" | "last";
}

export interface SortCommandNode {
  type: "SortCommand";
  fields: SortFieldDef[];
  loc?: SourceLocation;
}

export interface EvalAssignmentNode {
  target: string;
  expression: ExpressionNode;
  loc?: SourceLocation;
}

export interface EvalCommandNode {
  type: "EvalCommand";
  assignments: EvalAssignmentNode[];
  loc?: SourceLocation;
}

export interface StatsCommandNode {
  type: "StatsCommand";
  aggregations: AggregationDefNode[];
  byFields: string[];
  loc?: SourceLocation;
}

export interface EventstatsCommandNode {
  type: "EventstatsCommand";
  aggregations: AggregationDefNode[];
  byFields: string[];
  loc?: SourceLocation;
}

export interface StreamstatsCommandNode {
  type: "StreamstatsCommand";
  aggregations: AggregationDefNode[];
  byFields: string[];
  loc?: SourceLocation;
}

export interface TopCommandNode {
  type: "TopCommand";
  field: string;
  byField?: string;
  limit: number;
  loc?: SourceLocation;
}

export interface RareCommandNode {
  type: "RareCommand";
  field: string;
  byField?: string;
  limit: number;
  loc?: SourceLocation;
}

export interface TimechartCommandNode {
  type: "TimechartCommand";
  span: string; // e.g. "15m", "1h"
  aggregations: AggregationDefNode[];
  byField?: string;
  loc?: SourceLocation;
}

export interface BucketCommandNode {
  type: "BucketCommand";
  field: string;
  span: string;
  alias?: string;
  loc?: SourceLocation;
}

export interface SessionCommandNode {
  type: "SessionCommand";
  byField: string;
  maxGap: string; // duration e.g. "30m"
  loc?: SourceLocation;
}

export interface ParseCommandNode {
  type: "ParseCommand";
  template: string;
  fromField: string;
  targetFields: string[];
  loc?: SourceLocation;
}

export interface ExtractCommandNode {
  type: "ExtractCommand";
  regex: string;
  fromField: string;
  flags?: string;
  loc?: SourceLocation;
}

export interface UnionCommandNode {
  type: "UnionCommand";
  pipeline: PipelineNode;
  loc?: SourceLocation;
}

export interface JoinCommandNode {
  type: "JoinCommand";
  joinKey: string;
  pipeline: PipelineNode;
  joinType: "inner" | "left";
  loc?: SourceLocation;
}

export interface LookupCommandNode {
  type: "LookupCommand";
  table: "assets" | "identities";
  field: string;
  loc?: SourceLocation;
}

export type CommandNode =
  | WhereCommandNode
  | SearchCommandNode
  | FieldsCommandNode
  | TableCommandNode
  | RenameCommandNode
  | HeadCommandNode
  | TailCommandNode
  | DedupCommandNode
  | SortCommandNode
  | EvalCommandNode
  | StatsCommandNode
  | EventstatsCommandNode
  | StreamstatsCommandNode
  | TopCommandNode
  | RareCommandNode
  | TimechartCommandNode
  | BucketCommandNode
  | SessionCommandNode
  | ParseCommandNode
  | ExtractCommandNode
  | UnionCommandNode
  | JoinCommandNode
  | LookupCommandNode;

// ---------------------------------------------------------------------------
// Root Pipeline
// ---------------------------------------------------------------------------

export interface PipelineNode {
  type: "Pipeline";
  baseSearch: BaseSearchNode;
  commands: CommandNode[];
  loc?: SourceLocation;
}

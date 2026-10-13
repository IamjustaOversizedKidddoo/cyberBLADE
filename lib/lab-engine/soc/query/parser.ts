/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Deterministic AST Parser with Precedence Pratt/Recursive Descent
 */

import { Lexer, type Token, type TokenType } from "./lexer";
import {
  type PipelineNode,
  type BaseSearchNode,
  type CommandNode,
  type SearchTerm,
  type FieldFilterNode,
  type KeywordSearchNode,
  type SearchLogicalNode,
  type ExpressionNode,
  type LiteralNode,
  type IdentifierNode,
  type AggregationDefNode,
  type AggregationFunction,
  type SortFieldDef,
  type SourceLocation,
} from "./ast";
import { BladeQLError, findClosestSuggestion } from "./errors";

const KNOWN_COMMANDS = [
  "where",
  "search",
  "fields",
  "table",
  "rename",
  "head",
  "tail",
  "limit",
  "dedup",
  "sort",
  "eval",
  "stats",
  "eventstats",
  "streamstats",
  "top",
  "rare",
  "timechart",
  "bucket",
  "session",
  "parse",
  "extract",
  "union",
  "append",
  "join",
  "lookup",
] as const;

const KNOWN_AGG_FUNCTIONS = [
  "count",
  "dc",
  "sum",
  "avg",
  "min",
  "max",
  "median",
  "stdev",
  "values",
  "list",
  "first",
  "last",
  "earliest",
  "latest",
] as const;

const KNOWN_EXPR_FUNCTIONS = [
  "if",
  "case",
  "coalesce",
  "isnull",
  "isnotnull",
  "lower",
  "upper",
  "len",
  "substr",
  "replace",
  "split",
  "trim",
  "contains",
  "startswith",
  "endswith",
  "concat",
  "tonumber",
  "tostring",
  "round",
  "floor",
  "ceil",
  "abs",
  "now",
  "strftime",
  "strptime",
  "time_diff",
  "relative_time",
  "cidrmatch",
  "is_private",
  "defang",
  "refang",
] as const;

export class Parser {
  private tokens: Token[];
  private current = 0;
  private rawQuery: string;

  constructor(query: string) {
    this.rawQuery = query;
    const lexer = new Lexer(query);
    this.tokens = lexer.tokenize();
  }

  public parse(): PipelineNode {
    const startLoc = this.peek().loc;

    let baseSearch: BaseSearchNode = {
      type: "BaseSearch",
      expression: null,
      loc: startLoc,
    };

    const commands: CommandNode[] = [];

    // If does not start with pipe, parse BaseSearch UNLESS first token is a known command
    if (!this.check("PIPE") && !this.isAtEnd()) {
      if (this.check("IDENTIFIER") && KNOWN_COMMANDS.includes(this.peek().value.toLowerCase() as any)) {
        commands.push(this.parseCommand());
      } else {
        baseSearch = this.parseBaseSearch();
      }
    }

    while (this.match("PIPE")) {
      if (this.isAtEnd()) {
        throw this.error(this.previous(), "Expected command after pipe '|'.");
      }
      const cmd = this.parseCommand();
      commands.push(cmd);
    }

    if (!this.isAtEnd()) {
      throw this.error(this.peek(), `Unexpected token '${this.peek().value}' after pipeline.`);
    }

    return {
      type: "Pipeline",
      baseSearch,
      commands,
      loc: startLoc,
    };
  }

  // ---------------------------------------------------------------------------
  // Base Search Parsing
  // ---------------------------------------------------------------------------

  private parseBaseSearch(): BaseSearchNode {
    const startLoc = this.peek().loc;
    let timeRange: { earliest?: string | number; latest?: string | number } | undefined;

    const terms: SearchTerm[] = [];

    while (!this.check("PIPE") && !this.isAtEnd()) {
      // Check for time filters: earliest=... or latest=...
      if (
        this.check("IDENTIFIER") &&
        (this.peek().value.toLowerCase() === "earliest" || this.peek().value.toLowerCase() === "latest") &&
        this.peek(1).type === "ASSIGN"
      ) {
        const timeField = this.advance().value.toLowerCase();
        this.advance(); // consume '='
        const valToken = this.advance();
        if (!timeRange) timeRange = {};
        if (timeField === "earliest") timeRange.earliest = valToken.value;
        else timeRange.latest = valToken.value;
        continue;
      }

      const term = this.parseSearchOr();
      terms.push(term);
    }

    let expression: SearchTerm | null = null;
    if (terms.length === 1) {
      expression = terms[0];
    } else if (terms.length > 1) {
      expression = {
        type: "SearchLogical",
        operator: "AND",
        operands: terms,
        loc: startLoc,
      };
    }

    return {
      type: "BaseSearch",
      expression,
      timeRange,
      loc: startLoc,
    };
  }

  private parseSearchOr(): SearchTerm {
    let left = this.parseSearchAnd();

    while (this.match("OR")) {
      const right = this.parseSearchAnd();
      left = {
        type: "SearchLogical",
        operator: "OR",
        operands: [left, right],
        loc: left.loc,
      };
    }

    return left;
  }

  private parseSearchAnd(): SearchTerm {
    let left = this.parseSearchUnary();

    while (this.match("AND")) {
      const right = this.parseSearchUnary();
      left = {
        type: "SearchLogical",
        operator: "AND",
        operands: [left, right],
        loc: left.loc,
      };
    }

    return left;
  }

  private parseSearchUnary(): SearchTerm {
    if (this.match("NOT")) {
      const sub = this.parseSearchUnary();
      return {
        type: "SearchLogical",
        operator: "NOT",
        operands: [sub],
        loc: this.previous().loc,
      };
    }
    return this.parseSearchPrimary();
  }

  private parseSearchPrimary(): SearchTerm {
    const token = this.peek();

    // Grouping: ( ... )
    if (this.match("LPAREN")) {
      const expr = this.parseSearchOr();
      this.consume("RPAREN", "Expected ')' after search expression.");
      return expr;
    }

    // Field comparison: field = value, field != value, field in (...)
    if (this.check("IDENTIFIER") && this.isComparisonOp(this.peek(1).type)) {
      const fieldToken = this.advance();
      const opToken = this.advance();
      const valToken = this.advance();

      return {
        type: "FieldFilter",
        field: fieldToken.value,
        operator: opToken.value as FieldFilterNode["operator"],
        value: this.tokenToLiteral(valToken),
        loc: fieldToken.loc,
      };
    }

    // Field in (...) or field in literal
    if (this.check("IDENTIFIER") && this.peek(1).type === "IN") {
      const fieldToken = this.advance();
      this.advance(); // consume IN
      const values: LiteralNode[] = [];
      if (this.match("LPAREN")) {
        if (!this.check("RPAREN")) {
          do {
            values.push(this.tokenToLiteral(this.advance()));
          } while (this.match("COMMA"));
        }
        this.consume("RPAREN", "Expected ')' closing 'IN' list.");
      } else {
        values.push(this.tokenToLiteral(this.advance()));
      }
      return {
        type: "FieldFilter",
        field: fieldToken.value,
        operator: "in",
        value: values,
        loc: fieldToken.loc,
      };
    }

    // Keyword or wildcard search
    if (
      this.match("STRING") ||
      this.match("NUMBER") ||
      this.match("IDENTIFIER") ||
      this.match("IP") ||
      this.match("CIDR") ||
      this.match("WILDCARD")
    ) {
      const prev = this.previous();
      return {
        type: "KeywordSearch",
        value: prev.value,
        isWildcard: prev.type === "WILDCARD" || prev.value.includes("*") || prev.value.includes("?"),
        loc: prev.loc,
      };
    }

    throw this.error(token, `Unexpected token '${token.value}' in search expression.`);
  }

  private isComparisonOp(type: TokenType): boolean {
    return (
      type === "ASSIGN" ||
      type === "EQ" ||
      type === "STRICT_EQ" ||
      type === "NEQ" ||
      type === "LT" ||
      type === "LTE" ||
      type === "GT" ||
      type === "GTE" ||
      type === "MATCH" ||
      type === "NOT_MATCH"
    );
  }

  private tokenToLiteral(token: Token): LiteralNode {
    if (token.type === "NUMBER") {
      return {
        type: "Literal",
        valueType: "number",
        value: parseFloat(token.value),
        raw: token.value,
        loc: token.loc,
      };
    }
    if (token.type === "BOOLEAN") {
      return {
        type: "Literal",
        valueType: "boolean",
        value: token.value === "true",
        raw: token.value,
        loc: token.loc,
      };
    }
    if (token.type === "NULL") {
      return {
        type: "Literal",
        valueType: "null",
        value: null,
        raw: "null",
        loc: token.loc,
      };
    }
    if (token.type === "DURATION") {
      return {
        type: "Literal",
        valueType: "duration",
        value: token.value,
        raw: token.value,
        loc: token.loc,
      };
    }
    if (token.type === "IP") {
      return {
        type: "Literal",
        valueType: "ip",
        value: token.value,
        raw: token.value,
        loc: token.loc,
      };
    }
    if (token.type === "CIDR") {
      return {
        type: "Literal",
        valueType: "cidr",
        value: token.value,
        raw: token.value,
        loc: token.loc,
      };
    }

    return {
      type: "Literal",
      valueType: "string",
      value: token.value,
      raw: token.value,
      loc: token.loc,
    };
  }

  // ---------------------------------------------------------------------------
  // Command Parsing
  // ---------------------------------------------------------------------------

  private parseCommand(): CommandNode {
    const cmdToken = this.consume("IDENTIFIER", "Expected command name after pipe.");
    const cmdName = cmdToken.value.toLowerCase();

    switch (cmdName) {
      case "where":
        return {
          type: "WhereCommand",
          predicate: this.parseExpression(),
          loc: cmdToken.loc,
        };

      case "search":
        return {
          type: "SearchCommand",
          expression: this.parseSearchOr(),
          loc: cmdToken.loc,
        };

      case "fields": {
        let mode: "include" | "exclude" = "include";
        if (this.match("MINUS")) mode = "exclude";
        else if (this.match("PLUS")) mode = "include";

        const fields: string[] = [];
        do {
          const f = this.consume("IDENTIFIER", "Expected field name in fields command.");
          fields.push(f.value);
        } while (this.match("COMMA") || (this.check("IDENTIFIER") && !this.check("PIPE")));

        return {
          type: "FieldsCommand",
          mode,
          fields,
          loc: cmdToken.loc,
        };
      }

      case "table": {
        const fields: string[] = [];
        do {
          const f = this.consume("IDENTIFIER", "Expected field name in table command.");
          fields.push(f.value);
        } while (this.match("COMMA") || (this.check("IDENTIFIER") && !this.check("PIPE")));

        return {
          type: "TableCommand",
          fields,
          loc: cmdToken.loc,
        };
      }

      case "rename": {
        const mappings: Array<{ from: string; to: string }> = [];
        do {
          const from = this.consume("IDENTIFIER", "Expected source field name in rename.");
          this.consume("AS", "Expected 'as' in rename command.");
          const to = this.consume("IDENTIFIER", "Expected target field name in rename.");
          mappings.push({ from: from.value, to: to.value });
        } while (this.match("COMMA"));

        return {
          type: "RenameCommand",
          mappings,
          loc: cmdToken.loc,
        };
      }

      case "head":
      case "limit": {
        const numToken = this.consume("NUMBER", `Expected integer row count in ${cmdName}.`);
        return {
          type: "HeadCommand",
          count: parseInt(numToken.value, 10),
          loc: cmdToken.loc,
        };
      }

      case "tail": {
        const numToken = this.consume("NUMBER", "Expected integer row count in tail.");
        return {
          type: "TailCommand",
          count: parseInt(numToken.value, 10),
          loc: cmdToken.loc,
        };
      }

      case "dedup": {
        const fields: string[] = [];
        do {
          const f = this.consume("IDENTIFIER", "Expected field name in dedup.");
          fields.push(f.value);
        } while (this.match("COMMA") || (this.check("IDENTIFIER") && !this.check("PIPE")));

        return {
          type: "DedupCommand",
          fields,
          loc: cmdToken.loc,
        };
      }

      case "sort": {
        const fields: SortFieldDef[] = [];
        do {
          let direction: "asc" | "desc" = "asc";
          if (this.match("MINUS")) direction = "desc";
          else if (this.match("PLUS")) direction = "asc";

          const f = this.consume("IDENTIFIER", "Expected field name in sort.");
          fields.push({ field: f.value, direction });
        } while (this.match("COMMA") || (this.check("IDENTIFIER") && !this.check("PIPE")));

        return {
          type: "SortCommand",
          fields,
          loc: cmdToken.loc,
        };
      }

      case "eval": {
        const assignments: Array<{ target: string; expression: ExpressionNode }> = [];
        do {
          const target = this.consume("IDENTIFIER", "Expected target variable name in eval.");
          this.consume("ASSIGN", "Expected '=' in eval assignment.");
          const expression = this.parseExpression();
          assignments.push({ target: target.value, expression });
        } while (this.match("COMMA"));

        return {
          type: "EvalCommand",
          assignments,
          loc: cmdToken.loc,
        };
      }

      case "stats":
      case "eventstats":
      case "streamstats": {
        const aggregations: AggregationDefNode[] = [];
        do {
          aggregations.push(this.parseAggregationDef());
        } while (this.match("COMMA") && !this.check("BY"));

        const byFields: string[] = [];
        if (this.match("BY")) {
          do {
            const f = this.consume("IDENTIFIER", "Expected grouping field name after 'by'.");
            byFields.push(f.value);
          } while (this.match("COMMA") || (this.check("IDENTIFIER") && !this.check("PIPE")));
        }

        const type =
          cmdName === "eventstats"
            ? "EventstatsCommand"
            : cmdName === "streamstats"
              ? "StreamstatsCommand"
              : "StatsCommand";

        return {
          type,
          aggregations,
          byFields,
          loc: cmdToken.loc,
        };
      }

      case "top":
      case "rare": {
        let limit = 10;
        if (this.check("NUMBER")) {
          limit = parseInt(this.advance().value, 10);
        }
        const field = this.consume("IDENTIFIER", `Expected field name in ${cmdName}.`).value;
        let byField: string | undefined;
        if (this.match("BY")) {
          byField = this.consume("IDENTIFIER", "Expected grouping field name in 'by'.").value;
        }

        return cmdName === "top"
          ? { type: "TopCommand", field, byField, limit, loc: cmdToken.loc }
          : { type: "RareCommand", field, byField, limit, loc: cmdToken.loc };
      }

      case "timechart": {
        // timechart span=15m count by host
        const spanParam = this.consume("IDENTIFIER", "Expected 'span=' duration parameter in timechart.");
        if (spanParam.value.toLowerCase() !== "span") {
          throw this.error(spanParam, "Expected 'span=' duration parameter in timechart.");
        }
        this.consume("ASSIGN", "Expected '=' after span.");
        const spanToken = this.consume("DURATION", "Expected duration literal (e.g. 15m, 1h) for timechart span.");

        const aggregations: AggregationDefNode[] = [];
        do {
          aggregations.push(this.parseAggregationDef());
        } while (this.match("COMMA") && !this.check("BY"));

        let byField: string | undefined;
        if (this.match("BY")) {
          byField = this.consume("IDENTIFIER", "Expected facet field name in timechart 'by'.").value;
        }

        return {
          type: "TimechartCommand",
          span: spanToken.value,
          aggregations,
          byField,
          loc: cmdToken.loc,
        };
      }

      case "bucket": {
        const field = this.consume("IDENTIFIER", "Expected field name in bucket.").value;
        const spanParam = this.consume("IDENTIFIER", "Expected 'span=' in bucket.");
        if (spanParam.value.toLowerCase() !== "span") {
          throw this.error(spanParam, "Expected 'span=' parameter in bucket.");
        }
        this.consume("ASSIGN", "Expected '=' after span.");
        const span = this.consume("DURATION", "Expected duration in bucket span.").value;
        let alias: string | undefined;
        if (this.match("AS")) {
          alias = this.consume("IDENTIFIER", "Expected alias field name after 'as'.").value;
        }

        return {
          type: "BucketCommand",
          field,
          span,
          alias,
          loc: cmdToken.loc,
        };
      }

      case "session": {
        // session by <field> maxgap=<duration>
        this.consume("BY", "Expected 'by' in session command.");
        const byField = this.consume("IDENTIFIER", "Expected session key field name.").value;
        const maxgapToken = this.consume("IDENTIFIER", "Expected 'maxgap=' parameter.");
        if (maxgapToken.value.toLowerCase() !== "maxgap") {
          throw this.error(maxgapToken, "Expected 'maxgap=' parameter in session.");
        }
        this.consume("ASSIGN", "Expected '=' after maxgap.");
        const maxGap = this.consume("DURATION", "Expected duration literal for maxgap (e.g. 30m).").value;

        return {
          type: "SessionCommand",
          byField,
          maxGap,
          loc: cmdToken.loc,
        };
      }

      case "parse": {
        // parse "<template>" from <field> as (f1, f2)
        const template = this.consume("STRING", "Expected template string in parse command.").value;
        this.consume("FROM", "Expected 'from' keyword in parse command.");
        const fromField = this.consume("IDENTIFIER", "Expected source field in parse.").value;
        this.consume("AS", "Expected 'as' keyword in parse command.");
        this.consume("LPAREN", "Expected '(' starting target fields list.");
        const targetFields: string[] = [];
        do {
          targetFields.push(this.consume("IDENTIFIER", "Expected target field name.").value);
        } while (this.match("COMMA"));
        this.consume("RPAREN", "Expected ')' closing target fields list.");

        return {
          type: "ParseCommand",
          template,
          fromField,
          targetFields,
          loc: cmdToken.loc,
        };
      }

      case "extract": {
        // extract /<regex>/ from <field>
        const regexToken = this.consume("REGEX", "Expected regex literal /.../ in extract command.");
        this.consume("FROM", "Expected 'from' keyword in extract command.");
        const fromField = this.consume("IDENTIFIER", "Expected source field in extract.").value;

        return {
          type: "ExtractCommand",
          regex: regexToken.value,
          fromField,
          loc: cmdToken.loc,
        };
      }

      case "union":
      case "append": {
        this.consume("LBRACKET", `Expected '[' starting subsearch pipeline for ${cmdName}.`);
        const subParser = new Parser(this.extractSubsearchQuery());
        const pipeline = subParser.parse();
        this.consume("RBRACKET", `Expected ']' ending subsearch pipeline for ${cmdName}.`);

        return {
          type: "UnionCommand",
          pipeline,
          loc: cmdToken.loc,
        };
      }

      case "join": {
        const joinKey = this.consume("IDENTIFIER", "Expected join key field name.").value;
        this.consume("LBRACKET", "Expected '[' starting subsearch in join.");
        const subParser = new Parser(this.extractSubsearchQuery());
        const pipeline = subParser.parse();
        this.consume("RBRACKET", "Expected ']' ending subsearch in join.");

        return {
          type: "JoinCommand",
          joinKey,
          pipeline,
          joinType: "inner",
          loc: cmdToken.loc,
        };
      }

      case "lookup": {
        const tableToken = this.consume("IDENTIFIER", "Expected lookup table name ('assets' or 'identities').");
        const table = tableToken.value.toLowerCase();
        if (table !== "assets" && table !== "identities") {
          throw this.error(tableToken, "Only 'assets' and 'identities' lookup tables are supported.");
        }
        const field = this.consume("IDENTIFIER", "Expected lookup match field.").value;

        return {
          type: "LookupCommand",
          table: table as "assets" | "identities",
          field,
          loc: cmdToken.loc,
        };
      }

      default: {
        const suggestion = findClosestSuggestion(cmdName, KNOWN_COMMANDS);
        const msg = suggestion
          ? `Unknown BladeQL command '${cmdName}'. Did you mean '${suggestion}'?`
          : `Unknown BladeQL command '${cmdName}'.`;
        throw new BladeQLError({
          code: "INVALID_COMMAND",
          message: msg,
          loc: cmdToken.loc,
          suggestion: suggestion ? `Did you mean '${suggestion}'?` : undefined,
          rawQuery: this.rawQuery,
        });
      }
    }
  }

  private extractSubsearchQuery(): string {
    // Extract tokens until matching RBRACKET
    const startToken = this.peek();
    let depth = 1;
    let query = "";

    while (!this.isAtEnd()) {
      if (this.check("LBRACKET")) depth++;
      else if (this.check("RBRACKET")) {
        depth--;
        if (depth === 0) break;
      }
      query += this.advance().value + " ";
    }

    if (depth !== 0) {
      throw this.error(startToken, "Unterminated subsearch: missing ']' bracket.");
    }

    return query.trim();
  }

  private parseAggregationDef(): AggregationDefNode {
    const fnToken = this.consume("IDENTIFIER", "Expected aggregation function name (e.g. count, sum, dc).");
    const fnName = fnToken.value.toLowerCase() as AggregationFunction;

    if (!KNOWN_AGG_FUNCTIONS.includes(fnName)) {
      const suggestion = findClosestSuggestion(fnName, KNOWN_AGG_FUNCTIONS);
      const msg = suggestion
        ? `Unknown aggregation function '${fnName}'. Did you mean '${suggestion}'?`
        : `Unknown aggregation function '${fnName}'. Valid: ${KNOWN_AGG_FUNCTIONS.join(", ")}`;
      throw new BladeQLError({
        code: "INVALID_AGGREGATION",
        message: msg,
        loc: fnToken.loc,
        suggestion: suggestion ? `Did you mean '${suggestion}'?` : undefined,
        rawQuery: this.rawQuery,
      });
    }

    let field: string | undefined;
    if (this.match("LPAREN")) {
      if (!this.check("RPAREN")) {
        field = this.consume("IDENTIFIER", "Expected field name in aggregation function.").value;
      }
      this.consume("RPAREN", "Expected ')' closing aggregation function.");
    } else if (fnName !== "count") {
      throw this.error(this.peek(), `Expected '(' after aggregation function '${fnName}'.`);
    }

    let alias: string | undefined;
    if (this.match("AS")) {
      alias = this.consume("IDENTIFIER", "Expected alias field name after 'as'.").value;
    }

    return {
      type: "AggregationDef",
      func: fnName,
      field,
      alias,
      loc: fnToken.loc,
    };
  }

  // ---------------------------------------------------------------------------
  // Expression Parsing (Recursive Descent with Precedence)
  // ---------------------------------------------------------------------------

  private parseExpression(): ExpressionNode {
    return this.parseExprOr();
  }

  private parseExprOr(): ExpressionNode {
    let left = this.parseExprAnd();
    while (this.match("OR")) {
      const right = this.parseExprAnd();
      left = {
        type: "BinaryExpression",
        operator: "or",
        left,
        right,
        loc: left.loc,
      };
    }
    return left;
  }

  private parseExprAnd(): ExpressionNode {
    let left = this.parseExprEquality();
    while (this.match("AND")) {
      const right = this.parseExprEquality();
      left = {
        type: "BinaryExpression",
        operator: "and",
        left,
        right,
        loc: left.loc,
      };
    }
    return left;
  }

  private parseExprEquality(): ExpressionNode {
    let left = this.parseExprRelational();
    while (
      this.match("EQ") ||
      this.match("ASSIGN") ||
      this.match("STRICT_EQ") ||
      this.match("NEQ") ||
      this.match("MATCH") ||
      this.match("NOT_MATCH")
    ) {
      const op = this.previous().value as ExpressionNode extends { operator: infer O } ? O : any;
      const right = this.parseExprRelational();
      left = {
        type: "BinaryExpression",
        operator: op === "=" ? "==" : op,
        left,
        right,
        loc: left.loc,
      };
    }
    return left;
  }

  private parseExprRelational(): ExpressionNode {
    let left = this.parseExprAdditive();
    while (this.match("LT") || this.match("LTE") || this.match("GT") || this.match("GTE")) {
      const op = this.previous().value as any;
      const right = this.parseExprAdditive();
      left = {
        type: "BinaryExpression",
        operator: op,
        left,
        right,
        loc: left.loc,
      };
    }
    return left;
  }

  private parseExprAdditive(): ExpressionNode {
    let left = this.parseExprMultiplicative();
    while (this.match("PLUS") || this.match("MINUS")) {
      const op = this.previous().value as "+" | "-";
      const right = this.parseExprMultiplicative();
      left = {
        type: "BinaryExpression",
        operator: op,
        left,
        right,
        loc: left.loc,
      };
    }
    return left;
  }

  private parseExprMultiplicative(): ExpressionNode {
    let left = this.parseExprUnary();
    while (this.match("STAR") || this.match("SLASH") || this.match("PERCENT")) {
      const op = this.previous().value as "*" | "/" | "%";
      const right = this.parseExprUnary();
      left = {
        type: "BinaryExpression",
        operator: op,
        left,
        right,
        loc: left.loc,
      };
    }
    return left;
  }

  private parseExprUnary(): ExpressionNode {
    if (this.match("NOT") || this.match("MINUS") || this.match("PLUS")) {
      const op = this.previous().value as "+" | "-" | "not" | "!";
      const argument = this.parseExprUnary();
      return {
        type: "UnaryExpression",
        operator: op,
        argument,
        loc: this.previous().loc,
      };
    }
    return this.parseExprPrimary();
  }

  private parseExprPrimary(): ExpressionNode {
    const token = this.peek();

    // Grouping: ( ... )
    if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      this.consume("RPAREN", "Expected ')' closing parenthesized expression.");
      return expr;
    }

    // Function call: func(...)
    if (this.check("IDENTIFIER") && this.peek(1).type === "LPAREN") {
      const fnToken = this.advance();
      this.advance(); // consume LPAREN
      const fnName = fnToken.value.toLowerCase();

      const args: ExpressionNode[] = [];
      if (!this.check("RPAREN")) {
        do {
          args.push(this.parseExpression());
        } while (this.match("COMMA"));
      }
      this.consume("RPAREN", `Expected ')' after function arguments for '${fnName}'.`);

      if (!KNOWN_EXPR_FUNCTIONS.includes(fnName as any)) {
        const suggestion = findClosestSuggestion(fnName, KNOWN_EXPR_FUNCTIONS);
        const msg = suggestion
          ? `Unknown BladeQL function '${fnName}'. Did you mean '${suggestion}'?`
          : `Unknown BladeQL function '${fnName}'. Valid: ${KNOWN_EXPR_FUNCTIONS.join(", ")}`;
        throw new BladeQLError({
          code: "INVALID_FUNCTION",
          message: msg,
          loc: fnToken.loc,
          suggestion: suggestion ? `Did you mean '${suggestion}'?` : undefined,
          rawQuery: this.rawQuery,
        });
      }

      return {
        type: "FunctionCall",
        name: fnName,
        arguments: args,
        loc: fnToken.loc,
      };
    }

    // Literals
    if (this.match("NUMBER") || this.match("STRING") || this.match("BOOLEAN") || this.match("NULL") || this.match("DURATION")) {
      return this.tokenToLiteral(this.previous());
    }

    // Identifier / Field
    if (this.match("IDENTIFIER")) {
      return {
        type: "Identifier",
        name: this.previous().value,
        loc: this.previous().loc,
      };
    }

    throw this.error(token, `Unexpected token '${token.value}' in expression.`);
  }

  // ---------------------------------------------------------------------------
  // Token Stream Utilities
  // ---------------------------------------------------------------------------

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return type === "EOF";
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(offset = 0): Token {
    const idx = this.current + offset;
    return idx < this.tokens.length ? this.tokens[idx] : this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): BladeQLError {
    return new BladeQLError({
      code: "SYNTAX_ERROR",
      message,
      loc: token.loc,
      rawQuery: this.rawQuery,
    });
  }
}

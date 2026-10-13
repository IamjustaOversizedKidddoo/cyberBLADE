/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Deterministic Lexer & Tokenizer with Source Position Tracking
 */

import { BladeQLError } from "./errors";
import type { SourceLocation } from "./ast";

export type TokenType =
  | "PIPE" // |
  | "IDENTIFIER"
  | "STRING"
  | "NUMBER"
  | "DURATION"
  | "IP"
  | "CIDR"
  | "WILDCARD"
  | "REGEX"
  | "BOOLEAN"
  | "NULL"
  // Comparison & Assignment Operators
  | "ASSIGN" // =
  | "EQ" // == or = (in search context)
  | "STRICT_EQ" // ===
  | "NEQ" // !=
  | "LT" // <
  | "LTE" // <=
  | "GT" // >
  | "GTE" // >=
  | "MATCH" // =~
  | "NOT_MATCH" // !~
  // Arithmetic Operators
  | "PLUS" // +
  | "MINUS" // -
  | "STAR" // *
  | "SLASH" // /
  | "PERCENT" // %
  // Delimiters
  | "LPAREN" // (
  | "RPAREN" // )
  | "LBRACKET" // [
  | "RBRACKET" // ]
  | "COMMA" // ,
  | "COLON" // :
  | "DOT" // .
  // Logical Keywords
  | "AND"
  | "OR"
  | "NOT"
  | "IN"
  | "AS"
  | "BY"
  | "FROM"
  | "SPAN"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
}

export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private len: number;

  constructor(input: string) {
    this.input = input;
    this.len = input.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.len) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.len) break;

      const token = this.nextToken();
      tokens.push(token);
    }

    tokens.push({
      type: "EOF",
      value: "",
      loc: {
        line: this.line,
        column: this.column,
        offset: this.pos,
        length: 0,
      },
    });

    return tokens;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.len) {
      const ch = this.input[this.pos];

      // Whitespace
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }
      if (ch === "\n") {
        this.pos++;
        this.line++;
        this.column = 1;
        continue;
      }

      // Comments: # or //
      if (ch === "#") {
        while (this.pos < this.len && this.input[this.pos] !== "\n") {
          this.pos++;
        }
        continue;
      }
      if (ch === "/" && this.pos + 1 < this.len && this.input[this.pos + 1] === "/") {
        this.pos += 2;
        while (this.pos < this.len && this.input[this.pos] !== "\n") {
          this.pos++;
        }
        continue;
      }

      break;
    }
  }

  private advance(): string {
    const ch = this.input[this.pos++];
    this.column++;
    return ch;
  }

  private peek(offset = 0): string {
    return this.pos + offset < this.len ? this.input[this.pos + offset] : "";
  }

  private nextToken(): Token {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;

    const makeToken = (type: TokenType, value: string): Token => ({
      type,
      value,
      loc: {
        line: startLine,
        column: startCol,
        offset: startOffset,
        length: this.pos - startOffset,
      },
    });

    const ch = this.peek();

    // Pipe separator
    if (ch === "|") {
      this.advance();
      if (this.peek() === "|") {
        this.advance();
        return makeToken("OR", "||");
      }
      return makeToken("PIPE", "|");
    }

    // Delimiters
    if (ch === "(") {
      this.advance();
      return makeToken("LPAREN", "(");
    }
    if (ch === ")") {
      this.advance();
      return makeToken("RPAREN", ")");
    }
    if (ch === "[") {
      this.advance();
      return makeToken("LBRACKET", "[");
    }
    if (ch === "]") {
      this.advance();
      return makeToken("RBRACKET", "]");
    }
    if (ch === ",") {
      this.advance();
      return makeToken("COMMA", ",");
    }

    // Arithmetic & Operators
    if (ch === "+") {
      this.advance();
      return makeToken("PLUS", "+");
    }
    if (ch === "-") {
      this.advance();
      return makeToken("MINUS", "-");
    }
    if (ch === "*") {
      // Check if isolated star or wildcard
      this.advance();
      return makeToken("STAR", "*");
    }
    if (ch === "%") {
      this.advance();
      return makeToken("PERCENT", "%");
    }

    // Regex literal: /pattern/flags
    if (ch === "/" && this.isRegexStart()) {
      return this.readRegex();
    }

    if (ch === "/") {
      this.advance();
      return makeToken("SLASH", "/");
    }

    // Comparison Operators
    if (ch === "=") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        if (this.peek() === "=") {
          this.advance();
          return makeToken("STRICT_EQ", "===");
        }
        return makeToken("EQ", "==");
      }
      if (this.peek() === "~") {
        this.advance();
        return makeToken("MATCH", "=~");
      }
      return makeToken("ASSIGN", "=");
    }

    if (ch === "!") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return makeToken("NEQ", "!=");
      }
      if (this.peek() === "~") {
        this.advance();
        return makeToken("NOT_MATCH", "!~");
      }
      return makeToken("NOT", "!");
    }

    if (ch === "<") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return makeToken("LTE", "<=");
      }
      return makeToken("LT", "<");
    }

    if (ch === ">") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return makeToken("GTE", ">=");
      }
      return makeToken("GT", ">");
    }

    if (ch === "&" && this.peek(1) === "&") {
      this.advance();
      this.advance();
      return makeToken("AND", "&&");
    }

    // Strings
    if (ch === '"' || ch === "'") {
      return this.readString(ch);
    }

    // Numbers, Durations, IPs, or CIDRs starting with digit
    if (/[0-9]/.test(ch)) {
      return this.readNumberOrIpOrDuration();
    }

    // Identifiers, Keywords, Wildcards
    return this.readIdentifierOrKeyword();
  }

  private readString(quote: string): Token {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;

    this.advance(); // consume opening quote
    let value = "";

    while (this.pos < this.len) {
      const ch = this.peek();
      if (ch === quote) {
        this.advance(); // consume closing quote
        return {
          type: "STRING",
          value,
          loc: {
            line: startLine,
            column: startCol,
            offset: startOffset,
            length: this.pos - startOffset,
          },
        };
      }

      if (ch === "\\") {
        this.advance();
        if (this.pos >= this.len) break;
        const esc = this.advance();
        if (esc === "n") value += "\n";
        else if (esc === "t") value += "\t";
        else if (esc === "r") value += "\r";
        else if (esc === '"') value += '"';
        else if (esc === "'") value += "'";
        else if (esc === "\\") value += "\\";
        else value += esc;
        continue;
      }

      if (ch === "\n") {
        this.line++;
        this.column = 1;
      }
      value += this.advance();
    }

    throw new BladeQLError({
      code: "UNTERMINATED_STRING",
      message: `Unterminated string literal starting at line ${startLine}, column ${startCol}.`,
      loc: {
        line: startLine,
        column: startCol,
        offset: startOffset,
        length: this.pos - startOffset,
      },
    });
  }

  private isRegexStart(): boolean {
    // If followed by non-space, non-slash and has a closing slash
    const next = this.peek(1);
    if (!next || next === "/" || next === " " || next === "\t" || next === "\n") return false;
    // Lookahead for closing slash
    for (let i = this.pos + 1; i < this.len; i++) {
      if (this.input[i] === "\n") return false;
      if (this.input[i] === "/" && this.input[i - 1] !== "\\") return true;
    }
    return false;
  }

  private readRegex(): Token {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;

    this.advance(); // consume leading '/'
    let pattern = "";

    while (this.pos < this.len) {
      const ch = this.peek();
      if (ch === "/" && this.input[this.pos - 1] !== "\\") {
        this.advance(); // consume trailing '/'
        // Read flags
        let flags = "";
        while (this.pos < this.len && /[a-z]/i.test(this.peek())) {
          flags += this.advance();
        }
        return {
          type: "REGEX",
          value: flags ? `${pattern}#flags=${flags}` : pattern,
          loc: {
            line: startLine,
            column: startCol,
            offset: startOffset,
            length: this.pos - startOffset,
          },
        };
      }
      if (ch === "\n") break;
      pattern += this.advance();
    }

    throw new BladeQLError({
      code: "UNTERMINATED_REGEX",
      message: `Unterminated regex literal starting at line ${startLine}, column ${startCol}.`,
      loc: {
        line: startLine,
        column: startCol,
        offset: startOffset,
        length: this.pos - startOffset,
      },
    });
  }

  private readNumberOrIpOrDuration(): Token {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;

    let text = "";
    while (this.pos < this.len && /[0-9a-zA-Z._/:-]/.test(this.peek())) {
      text += this.advance();
    }

    const loc: SourceLocation = {
      line: startLine,
      column: startCol,
      offset: startOffset,
      length: this.pos - startOffset,
    };

    // 1. Check IP CIDR (e.g. 192.0.2.0/24 or 10.0.0.0/8)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(text)) {
      return { type: "CIDR", value: text, loc };
    }

    // 2. Check IPv4 (e.g. 192.0.2.1)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(text)) {
      return { type: "IP", value: text, loc };
    }

    // 3. Check Duration (e.g. 15m, 2h, 30s, 7d, 1w)
    if (/^\d+[smhdw]$/i.test(text)) {
      return { type: "DURATION", value: text.toLowerCase(), loc };
    }

    // 4. Pure Number (Integer or Float)
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return { type: "NUMBER", value: text, loc };
    }

    // 5. Wildcard or general token starting with digits (e.g. 404* or ws-01)
    if (text.includes("*") || text.includes("?")) {
      return { type: "WILDCARD", value: text, loc };
    }

    return { type: "IDENTIFIER", value: text, loc };
  }

  private readIdentifierOrKeyword(): Token {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;

    let text = "";
    while (this.pos < this.len && /[a-zA-Z0-9_.*?-]/.test(this.peek())) {
      text += this.advance();
    }

    const loc: SourceLocation = {
      line: startLine,
      column: startCol,
      offset: startOffset,
      length: this.pos - startOffset,
    };

    // Check wildcard pattern
    if (text.includes("*") || text.includes("?")) {
      return { type: "WILDCARD", value: text, loc };
    }

    const upper = text.toUpperCase();

    // Logical keywords
    if (upper === "AND") return { type: "AND", value: "AND", loc };
    if (upper === "OR") return { type: "OR", value: "OR", loc };
    if (upper === "NOT") return { type: "NOT", value: "NOT", loc };
    if (upper === "IN") return { type: "IN", value: "IN", loc };
    if (upper === "AS") return { type: "AS", value: "AS", loc };
    if (upper === "BY") return { type: "BY", value: "BY", loc };
    if (upper === "FROM") return { type: "FROM", value: "FROM", loc };

    // Booleans and Null
    if (text === "true" || text === "false") {
      return { type: "BOOLEAN", value: text, loc };
    }
    if (text === "null") {
      return { type: "NULL", value: "null", loc };
    }

    return { type: "IDENTIFIER", value: text, loc };
  }
}

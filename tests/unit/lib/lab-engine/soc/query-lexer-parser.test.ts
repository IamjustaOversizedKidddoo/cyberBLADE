import { describe, it, expect } from "vitest";
import { Lexer } from "@/lib/lab-engine/soc/query/lexer";
import { Parser } from "@/lib/lab-engine/soc/query/parser";
import { SafeRegex } from "@/lib/lab-engine/soc/query/safe-regex";
import { BladeQLError } from "@/lib/lab-engine/soc/query/errors";

describe("BladeQL Part B: Lexer, Parser, and Safe Regex Engine", () => {
  describe("Lexer Tokenization", () => {
    it("tokenizes base search keywords, strings with escapes, and operators", () => {
      const q = 'source="auth" src_ip=192.0.2.1 user!=null status="failed \\"password\\""';
      const lexer = new Lexer(q);
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe("IDENTIFIER");
      expect(tokens[0].value).toBe("source");
      expect(tokens[1].type).toBe("ASSIGN");
      expect(tokens[2].type).toBe("STRING");
      expect(tokens[2].value).toBe("auth");

      const ipToken = tokens.find((t) => t.type === "IP");
      expect(ipToken?.value).toBe("192.0.2.1");

      const escapedStrToken = tokens.find((t) => t.type === "STRING" && t.value.includes('failed "password"'));
      expect(escapedStrToken).toBeDefined();
    });

    it("tokenizes durations, CIDRs, and wildcards", () => {
      const q = 'earliest=-15m src_ip in 10.0.0.0/8 host="ws-*-01"';
      const lexer = new Lexer(q);
      const tokens = lexer.tokenize();

      const durationToken = tokens.find((t) => t.type === "DURATION");
      expect(durationToken?.value).toBe("15m");

      const cidrToken = tokens.find((t) => t.type === "CIDR");
      expect(cidrToken?.value).toBe("10.0.0.0/8");
    });

    it("ignores comments and whitespace gracefully", () => {
      const q = `
        # Search for failed logons
        source=auth action=logon // comment 2
        | stats count by user
      `;
      const lexer = new Lexer(q);
      const tokens = lexer.tokenize();
      const pipeToken = tokens.find((t) => t.type === "PIPE");
      expect(pipeToken).toBeDefined();
    });
  });

  describe("Safe Linear-Time Regex Engine & ReDoS Immunity", () => {
    it("rejects catastrophic backreferences and lookaround constructs", () => {
      expect(() => new SafeRegex("(a)\\1")).toThrowError(BladeQLError);
      expect(() => new SafeRegex("(?=.*[a-z])foo")).toThrowError(BladeQLError);
      expect(() => new SafeRegex("(a+)+$")).toThrowError(BladeQLError);
      expect(() => new SafeRegex("(a*)*$")).toThrowError(BladeQLError);
    });

    it("matches valid linear patterns in O(M*N) time", () => {
      const regex = new SafeRegex("^ws-[a-z0-9]+-\\d{2}$", "i");
      expect(regex.test("ws-finance-01")).toBe(true);
      expect(regex.test("ws-HR-99")).toBe(true);
      expect(regex.test("srv-dc-01")).toBe(false);
    });

    it("extracts named capture groups correctly", () => {
      const regex = new SafeRegex("(?<ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})");
      const match = regex.exec("Connection established from 198.51.100.24 on port 443");
      expect(match).not.toBeNull();
      expect(match?.groups.ip).toBe("198.51.100.24");
    });

    it("executes potentially hazardous repetition on non-matching long input without hanging", () => {
      // Classic non-matching stress test on bounded string
      const regex = new SafeRegex("a*a*a*b");
      const longA = "a".repeat(500);
      const start = Date.now();
      const match = regex.exec(longA);
      const duration = Date.now() - start;
      expect(match).toBeNull();
      expect(duration).toBeLessThan(100); // Must be practically instantaneous (<100ms)
    });
  });

  describe("Parser AST Generation", () => {
    it("parses full pipeline with base search, where, eval, and stats", () => {
      const q = `
        source=auth status_code!=200
        | where bytes_out > 1000
        | eval total = bytes_in + bytes_out, user_clean = lower(user)
        | stats count, dc(src_ip) as unique_sources by user_clean
        | sort -count
        | head 10
      `;

      const parser = new Parser(q);
      const ast = parser.parse();

      expect(ast.type).toBe("Pipeline");
      expect(ast.baseSearch.expression).not.toBeNull();
      expect(ast.commands.length).toBe(5);

      expect(ast.commands[0].type).toBe("WhereCommand");
      expect(ast.commands[1].type).toBe("EvalCommand");
      expect(ast.commands[2].type).toBe("StatsCommand");
      expect(ast.commands[3].type).toBe("SortCommand");
      expect(ast.commands[4].type).toBe("HeadCommand");
    });

    it("parses timechart and session commands", () => {
      const q = `
        source=endpoint
        | timechart span=15m count by host
        | session by user maxgap=30m
      `;
      const parser = new Parser(q);
      const ast = parser.parse();

      expect(ast.commands[0].type).toBe("TimechartCommand");
      if (ast.commands[0].type === "TimechartCommand") {
        expect(ast.commands[0].span).toBe("15m");
        expect(ast.commands[0].byField).toBe("host");
      }

      expect(ast.commands[1].type).toBe("SessionCommand");
      if (ast.commands[1].type === "SessionCommand") {
        expect(ast.commands[1].byField).toBe("user");
        expect(ast.commands[1].maxGap).toBe("30m");
      }
    });

    it("parses parse and extract commands", () => {
      const q = `
        source=web
        | parse "* - [*] *" from _raw as (ip, ts, msg)
        | extract /(?<session_id>[a-f0-9]{16})/ from msg
      `;
      const parser = new Parser(q);
      const ast = parser.parse();

      expect(ast.commands[0].type).toBe("ParseCommand");
      expect(ast.commands[1].type).toBe("ExtractCommand");
    });

    it("parses subsearches in union and join", () => {
      const q = `
        source=auth
        | union [ source=vpn | fields timestamp, user, src_ip ]
        | join host [ source=cmdb | fields host, asset_owner ]
      `;
      const parser = new Parser(q);
      const ast = parser.parse();

      expect(ast.commands[0].type).toBe("UnionCommand");
      expect(ast.commands[1].type).toBe("JoinCommand");
      if (ast.commands[1].type === "JoinCommand") {
        expect(ast.commands[1].joinKey).toBe("host");
        expect(ast.commands[1].pipeline.commands.length).toBe(1);
      }
    });

    it("provides did-you-mean suggestions on misspelled commands and functions", () => {
      expect(() => {
        const p = new Parser("source=auth | statz count by user");
        p.parse();
      }).toThrowError(/Did you mean 'stats'/);

      expect(() => {
        const p = new Parser("source=auth | eval u = lowr(user)");
        p.parse();
      }).toThrowError(/Did you mean 'lower'/);
    });
  });
});

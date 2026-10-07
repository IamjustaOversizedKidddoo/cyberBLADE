import type { Packet } from "./types";

export type FilterResult =
  | { ok: true; test: (p: Packet) => boolean }
  | { ok: false; error: string };

const PROTOCOLS = new Set(["arp", "icmp", "tcp", "udp", "dns", "http", "tls"]);

const FIELDS = new Set([
  "ip.src",
  "ip.dst",
  "ip.addr",
  "ip.ttl",
  "tcp.port",
  "tcp.srcport",
  "tcp.dstport",
  "udp.port",
  "udp.srcport",
  "udp.dstport",
  "tcp.flags.syn",
  "tcp.flags.ack",
  "tcp.flags.fin",
  "tcp.flags.reset",
  "dns.qry.name",
  "dns.flags.response",
  "dns.a",
  "http.request.method",
  "http.request.uri",
  "http.host",
  "http.response.code",
  "tls.handshake.extensions_server_name",
  "frame.number",
  "frame",
]);

const VALID_OPERATORS = new Set(["==", "!=", ">", "<", ">=", "<=", "contains"]);

type Token =
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "AND" }
  | { type: "OR" }
  | { type: "NOT" }
  | { type: "OP"; value: string }
  | { type: "STRING"; value: string }
  | { type: "IDENT"; value: string };

function tokenize(input: string): { tokens: Token[] } | { error: string } {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "(") {
      tokens.push({ type: "LPAREN" });
      i++;
      continue;
    }

    if (c === ")") {
      tokens.push({ type: "RPAREN" });
      i++;
      continue;
    }

    if (c === "&" && input[i + 1] === "&") {
      tokens.push({ type: "AND" });
      i += 2;
      continue;
    }

    if (c === "|" && input[i + 1] === "|") {
      tokens.push({ type: "OR" });
      i += 2;
      continue;
    }

    if (c === "!" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: "!=" });
      i += 2;
      continue;
    }

    if (c === "!") {
      tokens.push({ type: "NOT" });
      i++;
      continue;
    }

    if (c === "=" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: "==" });
      i += 2;
      continue;
    }

    if (c === "=") {
      return { error: '"=" is not a valid operator — use "=="' };
    }

    if (c === ">" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: ">=" });
      i += 2;
      continue;
    }

    if (c === "<" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: "<=" });
      i += 2;
      continue;
    }

    if (c === ">" || c === "<") {
      tokens.push({ type: "OP", value: c });
      i++;
      continue;
    }

    // String literal
    if (c === '"') {
      let str = "";
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i >= input.length) {
        return { error: "Invalid filter" };
      }
      i++; // skip closing quote
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // Identifiers, keywords, operators (like contains), IP addresses, numbers
    const start = i;
    while (i < input.length && !/[\s()=!<>&|"]/.test(input[i])) {
      i++;
    }
    const raw = input.slice(start, i);

    if (raw === "and") {
      tokens.push({ type: "AND" });
    } else if (raw === "or") {
      tokens.push({ type: "OR" });
    } else if (raw === "not") {
      tokens.push({ type: "NOT" });
    } else if (raw === "contains") {
      tokens.push({ type: "OP", value: "contains" });
    } else {
      tokens.push({ type: "IDENT", value: raw });
    }
  }

  return { tokens };
}

function packetAllText(p: Packet): string {
  const parts: string[] = [
    p.eth.src,
    p.eth.dst,
  ];
  if (p.arp) parts.push(p.arp.senderIp, p.arp.targetIp, p.arp.senderMac);
  if (p.ip) parts.push(p.ip.src, p.ip.dst);
  if (p.tcp?.payload) parts.push(p.tcp.payload);
  if (p.dns) {
    parts.push(p.dns.qname);
    if (p.dns.answers) {
      for (const a of p.dns.answers) parts.push(a.name, a.data);
    }
  }
  if (p.http?.request) {
    parts.push(p.http.request.method, p.http.request.uri, p.http.request.host);
    if (p.http.request.body) parts.push(p.http.request.body);
    for (const [, v] of p.http.request.headers) parts.push(v);
  }
  if (p.http?.response) {
    parts.push(p.http.response.phrase);
    if (p.http.response.body) parts.push(p.http.response.body);
    for (const [, v] of p.http.response.headers) parts.push(v);
  }
  if (p.tls?.sni) parts.push(p.tls.sni);

  return parts.join(" ");
}

type Predicate = (p: Packet) => boolean;

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parse(): { pred: Predicate } | { error: string } {
    let parenDepth = 0;
    for (const t of this.tokens) {
      if (t.type === "LPAREN") parenDepth++;
      else if (t.type === "RPAREN") parenDepth--;
      if (parenDepth < 0) return { error: "Unbalanced parentheses" };
    }
    if (parenDepth !== 0) return { error: "Unbalanced parentheses" };

    const expr = this.parseOr();
    if ("error" in expr) return expr;

    if (this.pos < this.tokens.length) {
      return { error: "Invalid filter" };
    }

    return expr;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private parseOr(): { pred: Predicate } | { error: string } {
    const leftRes = this.parseAnd();
    if ("error" in leftRes) return leftRes;

    let currentPred: Predicate = leftRes.pred;

    while (this.peek()?.type === "OR") {
      this.advance();
      const right = this.parseAnd();
      if ("error" in right) return right;
      const leftPred: Predicate = currentPred;
      const rightPred: Predicate = right.pred;
      currentPred = (p: Packet): boolean => leftPred(p) || rightPred(p);
    }

    return { pred: currentPred };
  }

  private parseAnd(): { pred: Predicate } | { error: string } {
    const leftRes = this.parseNot();
    if ("error" in leftRes) return leftRes;

    let currentPred: Predicate = leftRes.pred;

    while (this.peek()?.type === "AND") {
      this.advance();
      const right = this.parseNot();
      if ("error" in right) return right;
      const leftPred: Predicate = currentPred;
      const rightPred: Predicate = right.pred;
      currentPred = (p: Packet): boolean => leftPred(p) && rightPred(p);
    }

    return { pred: currentPred };
  }

  private parseNot(): { pred: Predicate } | { error: string } {
    if (this.peek()?.type === "NOT") {
      this.advance();
      const next = this.parseNot();
      if ("error" in next) return next;
      const nextPred = next.pred;
      return { pred: (p: Packet) => !nextPred(p) };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): { pred: Predicate } | { error: string } {
    const tok = this.peek();
    if (!tok) return { error: "Invalid filter" };

    if (tok.type === "LPAREN") {
      this.advance();
      const inner = this.parseOr();
      if ("error" in inner) return inner;
      if (this.peek()?.type !== "RPAREN") {
        return { error: "Unbalanced parentheses" };
      }
      this.advance();
      return inner;
    }

    if (tok.type === "IDENT") {
      const name = tok.value;
      this.advance();

      // Check if next token is an operator
      const next = this.peek();
      if (next?.type === "OP") {
        const opTok = this.advance() as { type: "OP"; value: string };
        const valTok = this.peek();
        if (!valTok || (valTok.type !== "IDENT" && valTok.type !== "STRING")) {
          return { error: `Expected a value after "${opTok.value}"` };
        }
        this.advance();

        if (!FIELDS.has(name)) {
          return { error: `"${name}" is not a valid protocol or field` };
        }

        const comp = buildComparison(name, opTok.value, valTok.value);
        if ("error" in comp) return comp;
        return { pred: comp.pred };
      }

      // Bare identifier: protocol name or field presence
      if (PROTOCOLS.has(name)) {
        return { pred: buildProtocolCheck(name) };
      }

      if (FIELDS.has(name)) {
        return { pred: buildFieldPresenceCheck(name) };
      }

      return { error: `"${name}" is not a valid protocol or field` };
    }

    return { error: "Invalid filter" };
  }
}

function buildProtocolCheck(protocol: string): Predicate {
  switch (protocol) {
    case "arp":
      return (p) => Boolean(p.arp);
    case "icmp":
      return (p) => Boolean(p.icmp);
    case "tcp":
      return (p) => Boolean(p.tcp);
    case "udp":
      return (p) => Boolean(p.udp);
    case "dns":
      return (p) => Boolean(p.dns);
    case "http":
      return (p) => Boolean(p.http);
    case "tls":
      return (p) => Boolean(p.tls);
    default:
      return () => false;
  }
}

function buildFieldPresenceCheck(field: string): Predicate {
  switch (field) {
    case "tls.handshake.extensions_server_name":
      return (p) => Boolean(p.tls?.sni);
    case "http.request.method":
      return (p) => Boolean(p.http?.request?.method);
    case "http.request.uri":
      return (p) => Boolean(p.http?.request?.uri);
    case "http.host":
      return (p) => Boolean(p.http?.request?.host);
    case "http.response.code":
      return (p) => p.http?.response?.code !== undefined;
    case "dns.qry.name":
      return (p) => Boolean(p.dns?.qname);
    case "dns.flags.response":
      return (p) => p.dns?.response !== undefined;
    case "dns.a":
      return (p) => Boolean(p.dns?.answers?.some((a) => a.type === "A"));
    case "ip.src":
      return (p) => Boolean(p.ip?.src);
    case "ip.dst":
      return (p) => Boolean(p.ip?.dst);
    case "ip.addr":
      return (p) => Boolean(p.ip);
    case "ip.ttl":
      return (p) => p.ip?.ttl !== undefined;
    case "tcp.port":
      return (p) => Boolean(p.tcp);
    case "tcp.srcport":
      return (p) => p.tcp?.srcport !== undefined;
    case "tcp.dstport":
      return (p) => p.tcp?.dstport !== undefined;
    case "udp.port":
      return (p) => Boolean(p.udp);
    case "udp.srcport":
      return (p) => p.udp?.srcport !== undefined;
    case "udp.dstport":
      return (p) => p.udp?.dstport !== undefined;
    case "tcp.flags.syn":
      return (p) => Boolean(p.tcp?.flags?.syn);
    case "tcp.flags.ack":
      return (p) => Boolean(p.tcp?.flags?.ack);
    case "tcp.flags.fin":
      return (p) => Boolean(p.tcp?.flags?.fin);
    case "tcp.flags.reset":
      return (p) => Boolean(p.tcp?.flags?.rst);
    case "frame.number":
      return (p) => p.no !== undefined;
    case "frame":
      return () => true;
    default:
      return () => false;
  }
}

function buildComparison(field: string, op: string, rawVal: string): { pred: Predicate } | { error: string } {
  if (!VALID_OPERATORS.has(op)) {
    return { error: `Invalid filter` };
  }

  if (field === "frame") {
    if (op !== "contains") return { error: "Invalid filter" };
    return {
      pred: (p) => packetAllText(p).includes(rawVal),
    };
  }

  const numVal = Number(rawVal);
  const isNum = !isNaN(numVal) && !isNaN(parseFloat(rawVal));

  const compare = (fieldVal: unknown): boolean => {
    if (fieldVal === undefined || fieldVal === null) return false;

    if (op === "contains") {
      return typeof fieldVal === "string" && fieldVal.includes(rawVal);
    }

    if (op === "==") {
      if (typeof fieldVal === "number" && isNum) return fieldVal === numVal;
      return String(fieldVal) === rawVal;
    }

    if (op === "!=") {
      if (typeof fieldVal === "number" && isNum) return fieldVal !== numVal;
      return String(fieldVal) !== rawVal;
    }

    if (typeof fieldVal === "number" && isNum) {
      if (op === ">") return fieldVal > numVal;
      if (op === "<") return fieldVal < numVal;
      if (op === ">=") return fieldVal >= numVal;
      if (op === "<=") return fieldVal <= numVal;
    }

    return false;
  };

  switch (field) {
    case "frame.number":
      return { pred: (p) => compare(p.no) };

    case "ip.src":
      return { pred: (p) => Boolean(p.ip && compare(p.ip.src)) };

    case "ip.dst":
      return { pred: (p) => Boolean(p.ip && compare(p.ip.dst)) };

    case "ip.addr":
      return {
        pred: (p) => {
          if (!p.ip) return false;
          if (op === "!=") return compare(p.ip.src) && compare(p.ip.dst);
          return compare(p.ip.src) || compare(p.ip.dst);
        },
      };

    case "ip.ttl":
      return { pred: (p) => Boolean(p.ip && compare(p.ip.ttl)) };

    case "tcp.port":
      return {
        pred: (p) => {
          if (!p.tcp) return false;
          if (op === "!=") return compare(p.tcp.srcport) && compare(p.tcp.dstport);
          return compare(p.tcp.srcport) || compare(p.tcp.dstport);
        },
      };

    case "tcp.srcport":
      return { pred: (p) => Boolean(p.tcp && compare(p.tcp.srcport)) };

    case "tcp.dstport":
      return { pred: (p) => Boolean(p.tcp && compare(p.tcp.dstport)) };

    case "udp.port":
      return {
        pred: (p) => {
          if (!p.udp) return false;
          if (op === "!=") return compare(p.udp.srcport) && compare(p.udp.dstport);
          return compare(p.udp.srcport) || compare(p.udp.dstport);
        },
      };

    case "udp.srcport":
      return { pred: (p) => Boolean(p.udp && compare(p.udp.srcport)) };

    case "udp.dstport":
      return { pred: (p) => Boolean(p.udp && compare(p.udp.dstport)) };

    case "tcp.flags.syn":
      return { pred: (p) => Boolean(p.tcp && compare(p.tcp.flags.syn ? 1 : 0)) };

    case "tcp.flags.ack":
      return { pred: (p) => Boolean(p.tcp && compare(p.tcp.flags.ack ? 1 : 0)) };

    case "tcp.flags.fin":
      return { pred: (p) => Boolean(p.tcp && compare(p.tcp.flags.fin ? 1 : 0)) };

    case "tcp.flags.reset":
      return { pred: (p) => Boolean(p.tcp && compare(p.tcp.flags.rst ? 1 : 0)) };

    case "dns.qry.name":
      return { pred: (p) => Boolean(p.dns && compare(p.dns.qname)) };

    case "dns.flags.response":
      return { pred: (p) => Boolean(p.dns && compare(p.dns.response ? 1 : 0)) };

    case "dns.a":
      return {
        pred: (p) => {
          if (!p.dns?.answers) return false;
          return p.dns.answers.some((a) => a.type === "A" && compare(a.data));
        },
      };

    case "http.request.method":
      return { pred: (p) => Boolean(p.http?.request && compare(p.http.request.method)) };

    case "http.request.uri":
      return { pred: (p) => Boolean(p.http?.request && compare(p.http.request.uri)) };

    case "http.host":
      return { pred: (p) => Boolean(p.http?.request && compare(p.http.request.host)) };

    case "http.response.code":
      return { pred: (p) => Boolean(p.http?.response && compare(p.http.response.code)) };

    case "tls.handshake.extensions_server_name":
      return { pred: (p) => Boolean(p.tls && compare(p.tls.sni)) };

    default:
      return { error: `"${field}" is not a valid protocol or field` };
  }
}

/** Compiles a Wireshark-style display filter into a predicate or returns an error. */
export function compileFilter(src: string): FilterResult {
  const trimmed = src.trim();
  if (!trimmed) {
    return { ok: true, test: () => true };
  }

  const tokenized = tokenize(trimmed);
  if ("error" in tokenized) {
    return { ok: false, error: tokenized.error };
  }

  const parser = new Parser(tokenized.tokens);
  const parsed = parser.parse();
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  return { ok: true, test: parsed.pred };
}

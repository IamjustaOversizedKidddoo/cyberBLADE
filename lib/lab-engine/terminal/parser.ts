import { resolvePath, type Vfs } from "./vfs";

export type ParsedCommand = {
  argv: string[];
  redirect?: { op: ">" | ">>"; path: string };
  /** Indexes of args whose wildcards were quoted, so they must not be glob-expanded. */
  literal?: number[];
};
export type Pipeline = { commands: ParsedCommand[] };
export type ParseError = { error: string };

const UNSUPPORTED = "syntax error: ';' and '&&' are not supported in this lab shell";

type Token = { kind: "word"; value: string; quotedWildcard: boolean } | { kind: "op"; value: "|" | ">" | ">>" };

function isNameChar(c: string | undefined, first: boolean): boolean {
  return !!c && (first ? /[A-Za-z_]/.test(c) : /[A-Za-z0-9_]/.test(c));
}

function tokenize(line: string, env: Record<string, string>): Token[] | ParseError {
  const tokens: Token[] = [];
  let word = "";
  let inWord = false;
  let quotedWildcard = false;
  let wordQuoted = false;
  let i = 0;

  const flush = () => {
    if (!inWord) return;
    // Unquoted leading ~ means home, like bash.
    if (!wordQuoted && (word === "~" || word.startsWith("~/"))) word = (env.HOME ?? "~") + word.slice(1);
    tokens.push({ kind: "word", value: word, quotedWildcard });
    word = "";
    inWord = false;
    quotedWildcard = false;
    wordQuoted = false;
  };

  const readVar = (): string | null => {
    // At line[i] === "$". Returns the expansion, or null when "$" is literal.
    if (line[i + 1] === "{") {
      const end = line.indexOf("}", i + 2);
      if (end === -1) return null;
      const name = line.slice(i + 2, end);
      i = end + 1;
      return env[name] ?? "";
    }
    if (!isNameChar(line[i + 1], true)) return null;
    let j = i + 1;
    while (isNameChar(line[j], false)) j++;
    const name = line.slice(i + 1, j);
    i = j;
    return env[name] ?? "";
  };

  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") {
      flush();
      i++;
    } else if (c === "|" || c === ">") {
      flush();
      if (c === ">" && line[i + 1] === ">") {
        tokens.push({ kind: "op", value: ">>" });
        i += 2;
      } else {
        tokens.push({ kind: "op", value: c });
        i++;
      }
    } else if (c === ";" || (c === "&" && line[i + 1] === "&")) {
      return { error: UNSUPPORTED };
    } else if (c === "\\") {
      inWord = true;
      if (i + 1 < line.length) word += line[i + 1];
      i += 2;
    } else if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end === -1) return { error: "syntax error: unexpected end of file" };
      const part = line.slice(i + 1, end);
      if (/[*?]/.test(part)) quotedWildcard = true;
      word += part;
      inWord = true;
      wordQuoted = true;
      i = end + 1;
    } else if (c === '"') {
      i++;
      let closed = false;
      while (i < line.length) {
        const d = line[i];
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        if (d === "\\" && ["$", '"', "\\", "`"].includes(line[i + 1])) {
          word += line[i + 1];
          i += 2;
        } else if (d === "$") {
          const value = readVar();
          if (value === null) {
            word += "$";
            i++;
          } else word += value;
        } else {
          if (d === "*" || d === "?") quotedWildcard = true;
          word += d;
          i++;
        }
      }
      if (!closed) return { error: "syntax error: unexpected end of file" };
      inWord = true;
      wordQuoted = true;
    } else if (c === "$") {
      const value = readVar();
      if (value === null) {
        word += "$";
        inWord = true;
        i++;
      } else {
        word += value;
        // An unquoted empty expansion produces no word at all (bash word splitting).
        if (value !== "") inWord = true;
      }
    } else {
      word += c;
      inWord = true;
      i++;
    }
  }
  flush();
  return tokens;
}

export function parseLine(line: string, env: Record<string, string>): Pipeline | ParseError {
  const tokens = tokenize(line, env);
  if ("error" in tokens) return tokens;
  if (tokens.length === 0) return { commands: [] };

  const commands: ParsedCommand[] = [];
  let current: ParsedCommand = { argv: [] };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "word") {
      if (t.quotedWildcard) (current.literal ??= []).push(current.argv.length);
      current.argv.push(t.value);
    } else if (t.value === "|") {
      if (current.argv.length === 0) return { error: "syntax error near unexpected token `|'" };
      commands.push(current);
      current = { argv: [] };
    } else {
      const target = tokens[i + 1];
      if (!target || target.kind !== "word") {
        return { error: `syntax error near unexpected token \`${target ? target.value : "newline"}'` };
      }
      current.redirect = { op: t.value, path: target.value };
      i++;
    }
  }
  if (current.argv.length === 0) return { error: "syntax error near unexpected token `|'" };
  commands.push(current);
  return { commands };
}

function globToRegExp(pattern: string): RegExp {
  const body = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp(`^${body}$`);
}

/** Expands * and ? in the last path segment of each argument (not the command name). */
export function expandGlobs(
  argv: string[],
  cwd: string,
  vfs: Vfs,
  home: string,
  opts: { user?: string; literal?: number[] } = {},
): string[] {
  const user = opts.user ?? "root";
  const literal = new Set(opts.literal ?? []);
  const out: string[] = [];
  argv.forEach((arg, index) => {
    if (index === 0 || literal.has(index) || !/[*?]/.test(arg)) {
      out.push(arg);
      return;
    }
    const slash = arg.lastIndexOf("/");
    const dirPart = slash === -1 ? "" : arg.slice(0, slash + 1);
    const pattern = arg.slice(slash + 1);
    if (/[*?]/.test(dirPart)) {
      out.push(arg);
      return;
    }
    let names: string[] = [];
    try {
      names = vfs.list(resolvePath(cwd, dirPart || ".", home), user).map(([name]) => name);
    } catch {
      names = [];
    }
    const re = globToRegExp(pattern);
    const matches = names
      .filter((n) => re.test(n) && (pattern.startsWith(".") || !n.startsWith(".")))
      .sort()
      .map((n) => dirPart + n);
    out.push(...(matches.length ? matches : [arg]));
  });
  return out;
}

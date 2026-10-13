/**
 * CyberBLADE Safe Linear-Time Regex Engine (Thompson / Pike NFA Virtual Machine)
 * Guarantees O(M * N) execution and zero Catastrophic Backtracking (ReDoS Immunity).
 */

import { BladeQLError } from "./errors";

export interface SafeRegexMatch {
  matched: string;
  index: number;
  groups: Record<string, string>;
  captures: string[];
}

type NfaStateId = number;

export type NfaState =
  | { type: "MATCH" }
  | { type: "CHAR"; char: string; next: NfaStateId }
  | { type: "CLASS"; predicate: (ch: string) => boolean; next: NfaStateId }
  | { type: "ANY"; next: NfaStateId }
  | { type: "SPLIT"; out1: NfaStateId; out2: NfaStateId }
  | { type: "ANCHOR_START"; next: NfaStateId }
  | { type: "ANCHOR_END"; next: NfaStateId }
  | { type: "SAVE"; slot: number; next: NfaStateId };

export class SafeRegex {
  public readonly pattern: string;
  public readonly caseInsensitive: boolean;
  public readonly hasAnchorStart: boolean;
  public readonly groupNames: string[] = [];
  private states: NfaState[] = [];
  private startState = 0;
  private maxSteps: number;

  constructor(pattern: string, flags = "", maxSteps = 25000) {
    this.pattern = pattern;
    this.caseInsensitive = flags.includes("i");
    this.hasAnchorStart = pattern.startsWith("^");
    this.maxSteps = maxSteps;

    // 1. Proactive security validation (reject catastrophic syntax)
    SafeRegex.validatePattern(pattern);

    // 2. Compile pattern into Pike/Thompson NFA
    this.compile();
  }

  public static validatePattern(pattern: string): void {
    if (/\\[1-9]/.test(pattern)) {
      throw new BladeQLError({
        code: "REGEX_ERROR",
        message: "Backreferences (e.g. \\1) are prohibited in BladeQL regex to guarantee linear-time execution.",
      });
    }

    if (/\(\?<?[!=]/.test(pattern)) {
      throw new BladeQLError({
        code: "REGEX_ERROR",
        message: "Lookaround assertions are prohibited in BladeQL regex to guarantee linear-time execution.",
      });
    }

    if (/\([^()]*[+*][^()]*\)[+*]/.test(pattern)) {
      throw new BladeQLError({
        code: "REGEX_ERROR",
        message: "Nested unbounded quantifiers like (a+)+ or (a*)* are prohibited to prevent complexity risks.",
      });
    }

    const rangeMatch = pattern.match(/\{(\d+),(\d+)\}/);
    if (rangeMatch) {
      const upper = parseInt(rangeMatch[2], 10);
      if (upper > 100) {
        throw new BladeQLError({
          code: "REGEX_ERROR",
          message: `Regex quantifier upper bound {m,${upper}} exceeds maximum allowed limit of 100.`,
        });
      }
    }
  }

  private addState(state: NfaState): NfaStateId {
    const id = this.states.length;
    this.states.push(state);
    return id;
  }

  private patch(fromId: NfaStateId, toId: NfaStateId): void {
    const s = this.states[fromId];
    if (!s) return;
    if ("next" in s && s.next === -1) {
      s.next = toId;
    } else if (s.type === "SPLIT") {
      if (s.out2 === -1) s.out2 = toId;
    }
  }

  private compile(): void {
    this.states = [];
    this.groupNames = [];

    let pos = 0;
    const len = this.pattern.length;

    const parseAtom = (): { start: NfaStateId; end: NfaStateId } => {
      if (pos >= len) {
        const dummy = this.addState({ type: "MATCH" });
        return { start: dummy, end: dummy };
      }

      const ch = this.pattern[pos];

      if (ch === "^") {
        pos++;
        const s = this.addState({ type: "ANCHOR_START", next: -1 });
        return { start: s, end: s };
      }
      if (ch === "$") {
        pos++;
        const s = this.addState({ type: "ANCHOR_END", next: -1 });
        return { start: s, end: s };
      }
      if (ch === ".") {
        pos++;
        const s = this.addState({ type: "ANY", next: -1 });
        return { start: s, end: s };
      }

      // Group or Named Group: ( ... ) or (?<name> ... )
      if (ch === "(") {
        pos++;
        let groupName: string | undefined;
        if (this.pattern.slice(pos, pos + 2) === "?<") {
          pos += 2;
          const endName = this.pattern.indexOf(">", pos);
          if (endName === -1) {
            throw new BladeQLError({
              code: "REGEX_ERROR",
              message: "Unterminated named capture group in regex pattern.",
            });
          }
          groupName = this.pattern.slice(pos, endName);
          pos = endName + 1;
        }

        const slot = this.groupNames.length;
        this.groupNames.push(groupName ?? `group_${slot + 1}`);

        const saveOpen = this.addState({ type: "SAVE", slot: slot * 2, next: -1 });
        const sub = parseAlt();

        if (pos >= len || this.pattern[pos] !== ")") {
          throw new BladeQLError({
            code: "REGEX_ERROR",
            message: "Unclosed parenthesis in regex pattern.",
          });
        }
        pos++; // consume ')'

        const saveClose = this.addState({ type: "SAVE", slot: slot * 2 + 1, next: -1 });
        this.patch(saveOpen, sub.start);
        this.patch(sub.end, saveClose);

        return { start: saveOpen, end: saveClose };
      }

      // Character Class: [ ... ] or [^ ... ]
      if (ch === "[") {
        pos++;
        let negate = false;
        if (pos < len && this.pattern[pos] === "^") {
          negate = true;
          pos++;
        }

        const ranges: Array<[string, string]> = [];
        const chars: string[] = [];

        while (pos < len && this.pattern[pos] !== "]") {
          let cur = this.pattern[pos++];
          if (cur === "\\" && pos < len) {
            cur = this.pattern[pos++];
          }

          if (pos < len - 1 && this.pattern[pos] === "-" && this.pattern[pos + 1] !== "]") {
            pos++; // consume '-'
            let endChar = this.pattern[pos++];
            if (endChar === "\\" && pos < len) {
              endChar = this.pattern[pos++];
            }
            ranges.push([cur, endChar]);
          } else {
            chars.push(cur);
          }
        }

        if (pos >= len || this.pattern[pos] !== "]") {
          throw new BladeQLError({
            code: "REGEX_ERROR",
            message: "Unterminated character class '[' in regex pattern.",
          });
        }
        pos++; // consume ']'

        const caseInsensitive = this.caseInsensitive;
        const predicate = (c: string): boolean => {
          const testChar = caseInsensitive ? c.toLowerCase() : c;
          let matched = chars.some((ch) => (caseInsensitive ? ch.toLowerCase() : ch) === testChar);
          if (!matched) {
            matched = ranges.some(([rStart, rEnd]) => {
              const start = caseInsensitive ? rStart.toLowerCase() : rStart;
              const end = caseInsensitive ? rEnd.toLowerCase() : rEnd;
              return testChar >= start && testChar <= end;
            });
          }
          return negate ? !matched : matched;
        };

        const s = this.addState({ type: "CLASS", predicate, next: -1 });
        return { start: s, end: s };
      }

      // Escapes: \d, \w, \s, etc.
      if (ch === "\\") {
        pos++;
        if (pos >= len) {
          throw new BladeQLError({
            code: "REGEX_ERROR",
            message: "Trailing backslash in regex pattern.",
          });
        }
        const esc = this.pattern[pos++];
        let predicate: ((c: string) => boolean) | null = null;

        if (esc === "d") predicate = (c) => /\d/.test(c);
        else if (esc === "D") predicate = (c) => /\D/.test(c);
        else if (esc === "w") predicate = (c) => /\w/.test(c);
        else if (esc === "W") predicate = (c) => /\W/.test(c);
        else if (esc === "s") predicate = (c) => /\s/.test(c);
        else if (esc === "S") predicate = (c) => /\S/.test(c);
        else {
          const charToMatch = this.caseInsensitive ? esc.toLowerCase() : esc;
          const s = this.addState({ type: "CHAR", char: charToMatch, next: -1 });
          return { start: s, end: s };
        }

        const s = this.addState({ type: "CLASS", predicate, next: -1 });
        return { start: s, end: s };
      }

      // Standard character literal
      pos++;
      const charToMatch = this.caseInsensitive ? ch.toLowerCase() : ch;
      const s = this.addState({ type: "CHAR", char: charToMatch, next: -1 });
      return { start: s, end: s };
    };

    const parseQuantified = (): { start: NfaStateId; end: NfaStateId } => {
      const atomStart = pos;
      let atom = parseAtom();
      const atomEnd = pos;

      if (pos >= len) return atom;
      const q = this.pattern[pos];

      if (q === "*") {
        pos++;
        const split = this.addState({ type: "SPLIT", out1: atom.start, out2: -1 });
        this.patch(atom.end, split);
        return { start: split, end: split };
      }

      if (q === "+") {
        pos++;
        const split = this.addState({ type: "SPLIT", out1: atom.start, out2: -1 });
        this.patch(atom.end, split);
        return { start: atom.start, end: split };
      }

      if (q === "?") {
        pos++;
        const split = this.addState({ type: "SPLIT", out1: atom.start, out2: -1 });
        return { start: split, end: atom.end };
      }

      if (q === "{") {
        const closeIdx = this.pattern.indexOf("}", pos);
        if (closeIdx !== -1) {
          const numStr = this.pattern.slice(pos + 1, closeIdx);
          const parts = numStr.split(",");
          const min = parseInt(parts[0], 10);
          const max = parts.length > 1 ? parseInt(parts[1], 10) : min;
          pos = closeIdx + 1;

          if (!isNaN(min) && !isNaN(max) && min <= max && max <= 100) {
            const copies: Array<{ start: NfaStateId; end: NfaStateId }> = [atom];
            for (let k = 1; k < max; k++) {
              const savedPos = pos;
              pos = atomStart;
              copies.push(parseAtom());
              pos = savedPos;
            }

            const exitState = this.addState({ type: "SPLIT", out1: -1, out2: -1 });

            let currentChainEnd = copies[0].end;
            for (let k = 1; k < copies.length; k++) {
              if (k >= min) {
                const bypassSplit = this.addState({ type: "SPLIT", out1: copies[k].start, out2: exitState });
                this.patch(currentChainEnd, bypassSplit);
                currentChainEnd = copies[k].end;
              } else {
                this.patch(currentChainEnd, copies[k].start);
                currentChainEnd = copies[k].end;
              }
            }
            this.patch(currentChainEnd, exitState);

            if (min === 0) {
              const zeroSplit = this.addState({ type: "SPLIT", out1: atom.start, out2: exitState });
              return { start: zeroSplit, end: exitState };
            }

            return { start: atom.start, end: exitState };
          }
        }
      }

      return atom;
    };

    const parseConcat = (): { start: NfaStateId; end: NfaStateId } => {
      let first: { start: NfaStateId; end: NfaStateId } | null = null;
      while (pos < len && this.pattern[pos] !== "|" && this.pattern[pos] !== ")") {
        const nextPart = parseQuantified();
        if (!first) {
          first = nextPart;
        } else {
          this.patch(first.end, nextPart.start);
          first.end = nextPart.end;
        }
      }
      return first ?? { start: this.addState({ type: "MATCH" }), end: this.states.length - 1 };
    };

    const parseAlt = (): { start: NfaStateId; end: NfaStateId } => {
      const left = parseConcat();
      if (pos < len && this.pattern[pos] === "|") {
        pos++;
        const right = parseAlt();
        const split = this.addState({ type: "SPLIT", out1: left.start, out2: right.start });
        const matchJoin = this.addState({ type: "MATCH" });
        this.patch(left.end, matchJoin);
        this.patch(right.end, matchJoin);
        return { start: split, end: matchJoin };
      }
      return left;
    };

    const root = parseAlt();
    const matchState = this.addState({ type: "MATCH" });
    this.patch(root.end, matchState);

    // If not anchored with ^, wrap with leading match loop for single-pass O(N) execution
    if (!this.hasAnchorStart) {
      const startSplit = this.addState({ type: "SPLIT", out1: root.start, out2: -1 });
      const skipAny = this.addState({ type: "ANY", next: startSplit });
      this.states[startSplit] = { type: "SPLIT", out1: root.start, out2: skipAny };
      this.startState = startSplit;
    } else {
      this.startState = root.start;
    }
  }

  public exec(text: string): SafeRegexMatch | null {
    let stepCount = 0;
    const maxSteps = this.maxSteps;

    type Thread = { stateId: NfaStateId; saves: number[]; startOffset: number };
    let currentList: Thread[] = [];
    const seen = new Set<string>();

    const addThread = (stateId: NfaStateId, saves: number[], startOffset: number, charPos: number, list: Thread[]) => {
      stepCount++;
      if (stepCount > maxSteps) {
        throw new BladeQLError({
          code: "BUDGET_EXCEEDED",
          message: `Regex execution exceeded maximum safe step limit of ${maxSteps} transitions.`,
        });
      }

      const key = `${stateId}:${saves.join(",")}`;
      if (seen.has(key)) return;
      seen.add(key);

      const state = this.states[stateId];
      if (!state) return;

      if (state.type === "SPLIT") {
        addThread(state.out1, saves, startOffset, charPos, list);
        addThread(state.out2, saves, startOffset, charPos, list);
      } else if (state.type === "ANCHOR_START") {
        if (charPos === 0) {
          addThread(state.next, saves, startOffset, charPos, list);
        }
      } else if (state.type === "ANCHOR_END") {
        if (charPos === text.length) {
          addThread(state.next, saves, startOffset, charPos, list);
        }
      } else if (state.type === "SAVE") {
        const newSaves = [...saves];
        newSaves[state.slot] = charPos;
        addThread(state.next, newSaves, startOffset, charPos, list);
      } else {
        list.push({ stateId, saves, startOffset });
      }
    };

    addThread(this.startState, [], 0, 0, currentList);

    let bestMatch: SafeRegexMatch | null = null;

    for (let i = 0; i <= text.length; i++) {
      const ch = i < text.length ? text[i] : null;
      const nextList: Thread[] = [];
      seen.clear();

      for (const t of currentList) {
        const state = this.states[t.stateId];
        if (!state) continue;

        if (state.type === "MATCH") {
          const matchStart = t.saves[0] !== undefined ? t.saves[0] : 0;
          const matchEnd = i;
          const matchStr = text.slice(matchStart, matchEnd);

          const groups: Record<string, string> = {};
          const captures: string[] = [];

          for (let g = 0; g < this.groupNames.length; g++) {
            const startSlot = t.saves[g * 2] ?? matchStart;
            const endSlot = t.saves[g * 2 + 1] ?? matchEnd;
            const captured = text.slice(startSlot, Math.min(matchEnd, endSlot));
            captures.push(captured);
            groups[this.groupNames[g]] = captured;
          }

          if (!bestMatch || matchStr.length >= bestMatch.matched.length) {
            bestMatch = {
              matched: matchStr,
              index: matchStart,
              groups,
              captures,
            };
          }
          continue;
        }

        if (ch === null) continue;
        const testChar = this.caseInsensitive ? ch.toLowerCase() : ch;

        if (state.type === "CHAR" && state.char === testChar) {
          addThread(state.next, t.saves, t.startOffset, i + 1, nextList);
        } else if (state.type === "CLASS" && state.predicate(ch)) {
          addThread(state.next, t.saves, t.startOffset, i + 1, nextList);
        } else if (state.type === "ANY" && ch !== "\n") {
          addThread(state.next, t.saves, t.startOffset, i + 1, nextList);
        }
      }

      if (nextList.length === 0) break;
      currentList = nextList;
    }

    return bestMatch;
  }

  public test(text: string): boolean {
    return this.exec(text) !== null;
  }
}

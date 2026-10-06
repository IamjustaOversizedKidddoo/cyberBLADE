import { VfsError, type VfsErrorCode } from "../vfs";
import type { CmdResult } from "./types";

const MESSAGES: Record<VfsErrorCode, string> = {
  ENOENT: "No such file or directory",
  ENOTDIR: "Not a directory",
  EISDIR: "Is a directory",
  EACCES: "Permission denied",
  EEXIST: "File exists",
};

/** Human message for a filesystem error, like the C library's strerror(). */
export function errorText(err: unknown): string {
  if (err instanceof VfsError) return MESSAGES[err.code];
  throw err;
}

export const ok = (stdout = ""): CmdResult => ({ stdout, stderr: "", code: 0 });

export const fail = (stderr: string, code = 1, stdout = ""): CmdResult => ({ stdout, stderr, code });

/** Lines of a text, without the empty string after a trailing newline. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export const joinLines = (lines: string[]): string => lines.map((l) => `${l}\n`).join("");

/**
 * Splits argv into single-letter flags and operands. Flags may be combined (-la).
 * Returns the first unknown flag letter, if any.
 */
export function parseFlags(args: string[], allowed: string): { flags: Set<string>; operands: string[]; bad?: string } {
  const flags = new Set<string>();
  const operands: string[] = [];
  for (const arg of args) {
    if (arg.length > 1 && arg.startsWith("-")) {
      for (const letter of arg.slice(1)) {
        if (!allowed.includes(letter)) return { flags, operands, bad: letter };
        flags.add(letter);
      }
    } else operands.push(arg);
  }
  return { flags, operands };
}

export const byteLength = (text: string): number => new TextEncoder().encode(text).length;

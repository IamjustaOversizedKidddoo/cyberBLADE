import type { DirNode, FileNode, Node } from "./types";

type Opts = Partial<{ owner: string; group: string; mode: number; mtime: string }>;

export const DEFAULT_MTIME = "2026-10-06T09:14:00.000Z";

function meta(opts: Opts, mode: number) {
  const owner = opts.owner ?? "root";
  return { owner, group: opts.group ?? owner, mode: opts.mode ?? mode, mtime: opts.mtime ?? DEFAULT_MTIME };
}

/** Builders for simulated machines (tests and lab generators). */
export function file(content: string, opts: Opts = {}): FileNode {
  return { kind: "file", content, ...meta(opts, 0o644) };
}

export function dir(children: Record<string, Node>, opts: Opts = {}): DirNode {
  return { kind: "dir", children, ...meta(opts, 0o755) };
}

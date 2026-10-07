import type { Vfs } from "../vfs";

/** The path and, with recurse, everything below it (pre-order, children sorted) — for -R options. */
export function walkTree(vfs: Vfs, path: string, recurse: boolean): string[] {
  const node = vfs.stat(path);
  if (!node || !recurse || node.kind !== "dir") return [path];
  const base = path === "/" ? "" : path;
  return [path, ...Object.keys(node.children).sort().flatMap((name) => walkTree(vfs, `${base}/${name}`, true))];
}

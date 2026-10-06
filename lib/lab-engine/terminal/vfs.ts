import type { DirNode, FileNode, Node } from "./types";

export type VfsErrorCode = "ENOENT" | "ENOTDIR" | "EISDIR" | "EACCES" | "EEXIST";

export class VfsError extends Error {
  constructor(
    readonly code: VfsErrorCode,
    readonly path: string,
  ) {
    super(`${code}: ${path}`);
  }
}

const R = 4;
const W = 2;
const X = 1;

/** Absolute, normalized path. `..` at `/` stays at `/`; `~` and `~/x` use home. */
export function resolvePath(cwd: string, p: string, home: string): string {
  let full = p;
  if (p === "~" || p.startsWith("~/")) full = home + p.slice(1);
  else if (!p.startsWith("/")) full = `${cwd}/${p}`;
  const parts: string[] = [];
  for (const seg of full.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function formatMode(node: Pick<Node, "kind" | "mode">): string {
  const bits = (shift: number) => {
    const b = (node.mode >> shift) & 7;
    return (b & R ? "r" : "-") + (b & W ? "w" : "-") + (b & X ? "x" : "-");
  };
  return (node.kind === "dir" ? "d" : "-") + bits(6) + bits(3) + bits(0);
}

function allowed(node: Node, user: string, bit: number): boolean {
  if (user === "root") return true;
  // v1 simplification: owner bits for the owner, "other" bits for everyone else (no group membership).
  const shift = node.owner === user ? 6 : 0;
  return ((node.mode >> shift) & bit) !== 0;
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export class Vfs {
  private root: DirNode;

  constructor(root: DirNode) {
    // Own copy: the world object the server sent is never mutated.
    this.root = structuredClone(root);
  }

  /** Raw lookup, no permission checks. */
  stat(path: string): Node | null {
    let node: Node = this.root;
    for (const seg of split(path)) {
      if (node.kind !== "dir" || !Object.hasOwn(node.children, seg)) return null;
      node = node.children[seg];
    }
    return node;
  }

  /** Walks to `path` as `user`: every ancestor must be a searchable directory. */
  private walk(path: string, user: string): Node {
    let node: Node = this.root;
    for (const seg of split(path)) {
      if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
      if (!allowed(node, user, X)) throw new VfsError("EACCES", path);
      if (!Object.hasOwn(node.children, seg)) throw new VfsError("ENOENT", path);
      node = node.children[seg];
    }
    return node;
  }

  private parentOf(path: string, user: string): { parent: DirNode; name: string } {
    const segs = split(path);
    const name = segs.pop();
    if (!name) throw new VfsError("EISDIR", path);
    const parent = this.walk("/" + segs.join("/"), user);
    if (parent.kind !== "dir") throw new VfsError("ENOTDIR", path);
    if (!allowed(parent, user, X)) throw new VfsError("EACCES", path);
    return { parent, name };
  }

  readFile(path: string, user: string): string {
    const node = this.walk(path, user);
    if (node.kind === "dir") throw new VfsError("EISDIR", path);
    if (!allowed(node, user, R)) throw new VfsError("EACCES", path);
    return node.content;
  }

  list(path: string, user: string): [string, Node][] {
    const node = this.walk(path, user);
    if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
    if (!allowed(node, user, R)) throw new VfsError("EACCES", path);
    return Object.entries(node.children);
  }

  /** Throws unless `user` may cd into `path`. */
  checkDir(path: string, user: string): void {
    const node = this.walk(path, user);
    if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
    if (!allowed(node, user, X)) throw new VfsError("EACCES", path);
  }

  write(path: string, content: string, user: string, append: boolean): void {
    const { parent, name } = this.parentOf(path, user);
    const existing = Object.hasOwn(parent.children, name) ? parent.children[name] : undefined;
    if (existing) {
      if (existing.kind === "dir") throw new VfsError("EISDIR", path);
      if (!allowed(existing, user, W)) throw new VfsError("EACCES", path);
      existing.content = append ? existing.content + content : content;
      existing.mtime = new Date().toISOString();
      return;
    }
    if (!allowed(parent, user, W)) throw new VfsError("EACCES", path);
    parent.children[name] = this.newFile(content, user);
  }

  mkdir(path: string, user: string, parents: boolean): void {
    const segs = split(path);
    for (let i = 1; i <= segs.length; i++) {
      const sub = "/" + segs.slice(0, i).join("/");
      const node = this.stat(sub);
      const last = i === segs.length;
      if (node) {
        if (node.kind !== "dir") throw new VfsError(last ? "EEXIST" : "ENOTDIR", path);
        if (last && !parents) throw new VfsError("EEXIST", path);
        continue;
      }
      if (!last && !parents) throw new VfsError("ENOENT", path);
      const { parent, name } = this.parentOf(sub, user);
      if (!allowed(parent, user, W)) throw new VfsError("EACCES", path);
      parent.children[name] = {
        kind: "dir",
        children: {},
        owner: user,
        group: user,
        mode: 0o755,
        mtime: new Date().toISOString(),
      };
    }
  }

  touch(path: string, user: string): void {
    const { parent, name } = this.parentOf(path, user);
    const existing = Object.hasOwn(parent.children, name) ? parent.children[name] : undefined;
    if (existing) {
      if (!allowed(existing, user, W)) throw new VfsError("EACCES", path);
      existing.mtime = new Date().toISOString();
      return;
    }
    if (!allowed(parent, user, W)) throw new VfsError("EACCES", path);
    parent.children[name] = this.newFile("", user);
  }

  private newFile(content: string, user: string): FileNode {
    return { kind: "file", content, owner: user, group: user, mode: 0o644, mtime: new Date().toISOString() };
  }
}

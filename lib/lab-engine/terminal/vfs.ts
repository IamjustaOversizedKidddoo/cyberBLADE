import { groupsOf } from "./identity";
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
  const m = node.mode;
  // Special bits replace the execute letter: lowercase when x is also set, uppercase when it isn't.
  const triple = (shift: number, special: boolean, letter: string) => {
    const b = (m >> shift) & 7;
    const x = b & X ? (special ? letter : "x") : special ? letter.toUpperCase() : "-";
    return (b & R ? "r" : "-") + (b & W ? "w" : "-") + x;
  };
  return (node.kind === "dir" ? "d" : "-") + triple(6, (m & 0o4000) !== 0, "s") + triple(3, (m & 0o2000) !== 0, "s") + triple(0, (m & 0o1000) !== 0, "t");
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export class Vfs {
  private root: DirNode;
  /** Bits removed from new files (0o666) and directories (0o777); the shell's umask command changes it. */
  umask: number;
  private groupCache = new Map<string, string[]>();
  /** Virtual filesystems (like /proc): built fresh by a provider on every lookup, never writable. */
  private mounts = new Map<string, () => DirNode>();

  constructor(root: DirNode, opts: { umask?: number } = {}) {
    // Own copy: the world object the server sent is never mutated.
    this.root = structuredClone(root);
    this.umask = opts.umask ?? 0o022;
  }

  /** Linux checks one class only: owner bits for the owner, else group bits for members, else other bits. */
  private allowed(node: Node, user: string, bit: number): boolean {
    if (user === "root") return bit !== X || node.kind === "dir" || (node.mode & 0o111) !== 0;
    let shift = 0;
    if (node.owner === user) shift = 6;
    else if (this.groupsOf(user).includes(node.group)) shift = 3;
    return ((node.mode >> shift) & bit) !== 0;
  }

  groupsOf(user: string): string[] {
    let groups = this.groupCache.get(user);
    if (!groups) this.groupCache.set(user, (groups = groupsOf(this, user)));
    return groups;
  }

  /** Raw change, no permission check: callers (chmod, chown) decide who may. */
  setMode(path: string, mode: number): void {
    if (this.isUnderMount(path)) throw new VfsError("EACCES", path);
    const node = this.stat(path);
    if (!node) throw new VfsError("ENOENT", path);
    node.mode = mode;
  }

  setOwner(path: string, owner?: string, group?: string): void {
    if (this.isUnderMount(path)) throw new VfsError("EACCES", path);
    const node = this.stat(path);
    if (!node) throw new VfsError("ENOENT", path);
    if (owner !== undefined) node.owner = owner;
    if (group !== undefined) node.group = group;
  }

  mount(path: string, provider: () => DirNode): void {
    this.mounts.set(path, provider);
  }

  private isUnderMount(path: string): boolean {
    return [...this.mounts.keys()].some((m) => path === m || path.startsWith(`${m}/`));
  }

  /** The child of a directory, with mount points replaced by their provider's tree. */
  private child(node: DirNode, seg: string, prefix: string): Node | null {
    const provider = this.mounts.get(prefix);
    if (provider) return provider();
    return Object.hasOwn(node.children, seg) ? node.children[seg] : null;
  }

  /** Raw lookup, no permission checks. */
  stat(path: string): Node | null {
    let node: Node = this.root;
    let prefix = "";
    for (const seg of split(path)) {
      prefix += `/${seg}`;
      const next: Node | null = node.kind === "dir" ? this.child(node, seg, prefix) : null;
      if (!next) return null;
      node = next;
    }
    return node;
  }

  /** Walks to `path` as `user`: every ancestor must be a searchable directory. */
  lookup(path: string, user: string): Node {
    return this.walk(path, user);
  }

  private walk(path: string, user: string): Node {
    let node: Node = this.root;
    let prefix = "";
    for (const seg of split(path)) {
      if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
      if (!this.allowed(node, user, X)) throw new VfsError("EACCES", path);
      prefix += `/${seg}`;
      const next = this.child(node, seg, prefix);
      if (!next) throw new VfsError("ENOENT", path);
      node = next;
    }
    return node;
  }

  private parentOf(path: string, user: string): { parent: DirNode; name: string } {
    const segs = split(path);
    const name = segs.pop();
    if (!name) throw new VfsError("EISDIR", path);
    const parent = this.walk("/" + segs.join("/"), user);
    if (parent.kind !== "dir") throw new VfsError("ENOTDIR", path);
    if (!this.allowed(parent, user, X)) throw new VfsError("EACCES", path);
    return { parent, name };
  }

  readFile(path: string, user: string): string {
    const node = this.walk(path, user);
    if (node.kind === "dir") throw new VfsError("EISDIR", path);
    if (!this.allowed(node, user, R)) throw new VfsError("EACCES", path);
    return node.content;
  }

  list(path: string, user: string): [string, Node][] {
    const node = this.walk(path, user);
    if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
    if (!this.allowed(node, user, R)) throw new VfsError("EACCES", path);
    return Object.entries(node.children);
  }

  /** Throws unless `user` may cd into `path`. */
  checkDir(path: string, user: string): void {
    const node = this.walk(path, user);
    if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
    if (!this.allowed(node, user, X)) throw new VfsError("EACCES", path);
  }

  write(path: string, content: string, user: string, append: boolean): void {
    if (this.isUnderMount(path)) throw new VfsError("EACCES", path);
    const { parent, name } = this.parentOf(path, user);
    const existing = Object.hasOwn(parent.children, name) ? parent.children[name] : undefined;
    if (existing) {
      if (existing.kind === "dir") throw new VfsError("EISDIR", path);
      if (!this.allowed(existing, user, W)) throw new VfsError("EACCES", path);
      existing.content = append ? existing.content + content : content;
      existing.mtime = new Date().toISOString();
      if (path.startsWith("/etc/")) this.groupCache.clear();
      return;
    }
    if (!this.allowed(parent, user, W)) throw new VfsError("EACCES", path);
    parent.children[name] = this.newFile(content, user);
    if (path.startsWith("/etc/")) this.groupCache.clear();
  }

  mkdir(path: string, user: string, parents: boolean): void {
    if (this.isUnderMount(path)) throw new VfsError("EACCES", path);
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
      if (!this.allowed(parent, user, W)) throw new VfsError("EACCES", path);
      parent.children[name] = {
        kind: "dir",
        children: {},
        owner: user,
        group: user,
        mode: 0o777 & ~this.umask,
        mtime: new Date().toISOString(),
      };
    }
  }

  touch(path: string, user: string): void {
    if (this.isUnderMount(path)) throw new VfsError("EACCES", path);
    const { parent, name } = this.parentOf(path, user);
    const existing = Object.hasOwn(parent.children, name) ? parent.children[name] : undefined;
    if (existing) {
      if (!this.allowed(existing, user, W)) throw new VfsError("EACCES", path);
      existing.mtime = new Date().toISOString();
      return;
    }
    if (!this.allowed(parent, user, W)) throw new VfsError("EACCES", path);
    parent.children[name] = this.newFile("", user);
  }

  private newFile(content: string, user: string): FileNode {
    return { kind: "file", content, owner: user, group: user, mode: 0o666 & ~this.umask, mtime: new Date().toISOString() };
  }
}

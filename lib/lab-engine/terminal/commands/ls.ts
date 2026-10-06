import type { Node } from "../types";
import { formatMode, resolvePath, VfsError } from "../vfs";
import type { Command, CmdContext } from "./types";
import { byteLength, errorText, parseFlags } from "./util";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** GNU ls in an English locale: case and punctuation (dots, slashes) are ignored first. */
const sortKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
export const compareNames = (a: string, b: string) =>
  sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : a < b ? -1 : a > b ? 1 : 0;
const byName = ([a]: [string, Node], [b]: [string, Node]) => compareNames(a, b);

function date(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${hh}:${mm}`;
}

const size = (node: Node) => (node.kind === "dir" ? 4096 : byteLength(node.content));

function longLines(entries: [string, Node][]): string[] {
  const ownerW = Math.max(...entries.map(([, n]) => n.owner.length));
  const groupW = Math.max(...entries.map(([, n]) => n.group.length));
  const sizeW = Math.max(...entries.map(([, n]) => String(size(n)).length));
  return entries.map(
    ([name, n]) =>
      `${formatMode(n)} 1 ${n.owner.padEnd(ownerW)} ${n.group.padEnd(groupW)} ${String(size(n)).padStart(sizeW)} ${date(n.mtime)} ${name}`,
  );
}

function render(entries: [string, Node][], long: boolean, isListing: boolean): string {
  if (entries.length === 0) return long && isListing ? "total 0\n" : "";
  if (!long) return entries.map(([name]) => name).join("  ") + "\n";
  const lines = longLines(entries);
  return (isListing ? `total ${entries.length}\n` : "") + lines.join("\n") + "\n";
}

function dirEntries(ctx: CmdContext, path: string, all: boolean): [string, Node][] {
  const entries = ctx.vfs.list(path, ctx.user).filter(([name]) => all || !name.startsWith("."));
  if (all) {
    const parent = resolvePath(path, "..", ctx.home);
    entries.push([".", ctx.vfs.lookup(path, ctx.user)], ["..", ctx.vfs.lookup(parent, ctx.user)]);
  }
  return entries.sort(byName);
}

export const ls: Command = {
  name: "ls",
  summary: "list files (-a shows hidden files, -l shows details)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "la");
    if (bad) {
      return { stdout: "", stderr: `ls: invalid option -- '${bad}'\nTry 'ls --help' for more information.\n`, code: 2 };
    }
    const long = flags.has("l");
    const all = flags.has("a");
    const targets = operands.length ? operands : ["."];
    let stderr = "";
    const files: [string, Node][] = [];
    const dirs: { label: string; path: string }[] = [];

    for (const arg of targets) {
      const path = resolvePath(ctx.cwd, arg, ctx.home);
      try {
        const node = ctx.vfs.lookup(path, ctx.user);
        if (node.kind === "dir") dirs.push({ label: arg, path });
        else files.push([arg, node]);
      } catch (err) {
        stderr += `ls: cannot access '${arg}': ${errorText(err)}\n`;
      }
    }

    const blocks: string[] = [];
    if (files.length) blocks.push(render(files.sort(byName), long, false));
    const headers = targets.length > 1;
    for (const { label, path } of dirs.sort((a, b) => compareNames(a.label, b.label))) {
      try {
        const body = render(dirEntries(ctx, path, all), long, true);
        blocks.push(headers ? `${label}:\n${body}` : body);
      } catch (err) {
        if (!(err instanceof VfsError)) throw err;
        stderr += `ls: cannot open directory '${label}': ${errorText(err)}\n`;
      }
    }
    return { stdout: blocks.join("\n"), stderr, code: stderr ? 2 : 0 };
  },
};

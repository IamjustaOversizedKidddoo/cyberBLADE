import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { lessonFrontmatterSchema, type Lesson } from "./schema";
import { isVisible, showDrafts } from "./visibility";

async function mdxFiles(dir: string, keep: (relative: string) => boolean): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return entries
    .map((e) => e.split(path.sep).join("/"))
    .filter((e) => e.endsWith(".mdx") && keep(e))
    .map((e) => path.join(dir, e));
}

async function parseLesson(filePath: string): Promise<Lesson> {
  const { data, content } = matter(await fs.readFile(filePath, "utf8"));
  const parsed = lessonFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${filePath}: ${issue.path.join(".") || "frontmatter"} — ${issue.message}`);
  }
  return { ...parsed.data, slug: path.basename(filePath, ".mdx"), filePath, body: content };
}

const TRACK_ORDER = ["core", "purple", "soc", "pentest", "cloud"];

/** Every lesson under <root>/core/rank-N/ and <root>/tracks/, validated and sorted. */
export async function loadLessons(root = "content"): Promise<Lesson[]> {
  const files = [
    ...(await mdxFiles(path.join(root, "core"), (rel) => /^rank-\d+\//.test(rel))),
    ...(await mdxFiles(path.join(root, "tracks"), () => true)),
  ];
  const lessons = await Promise.all(files.map(parseLesson));
  const seen = new Map<string, string>();
  for (const l of lessons) {
    const other = seen.get(l.id);
    if (other) throw new Error(`duplicate id ${l.id} in ${other} and ${l.filePath}`);
    seen.set(l.id, l.filePath);
  }
  return lessons.sort(
    (a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track) || a.rank - b.rank || a.order - b.order,
  );
}

// Content is part of the build; re-read on every call in dev so edits show up immediately.
let cached: Promise<Lesson[]> | null = null;
function allLessons(): Promise<Lesson[]> {
  if (process.env.NODE_ENV !== "production") return loadLessons();
  cached ??= loadLessons();
  return cached;
}

export async function getLessons(filter: { rank?: number; track?: Lesson["track"] } = {}): Promise<Lesson[]> {
  const drafts = showDrafts();
  return (await allLessons()).filter(
    (l) =>
      isVisible(l, drafts) &&
      (filter.rank === undefined || l.rank === filter.rank) &&
      (filter.track === undefined || l.track === filter.track),
  );
}

export async function getLesson(id: string): Promise<Lesson | null> {
  return (await getLessons()).find((l) => l.id === id) ?? null;
}

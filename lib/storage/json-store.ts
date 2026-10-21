import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type JsonStore<T> = {
  read(): Promise<T>;
  update(fn: (draft: T) => void): Promise<T>;
};

// One queue per absolute file path, shared by every store instance in this process.
const queues = new Map<string, Promise<unknown>>();

function serialize<R>(key: string, task: () => Promise<R>): Promise<R> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(key, next.catch(() => undefined));
  return next;
}

export function dataPath(name: string): string {
  if (!name || typeof name !== "string") {
    throw new Error("Invalid storage file name: name must be a non-empty string");
  }
  if (name.includes("..") || path.isAbsolute(name) || /[\/\\]/.test(name)) {
    throw new Error(`Invalid storage file name '${name}': path traversal characters are rejected`);
  }
  const baseDir = process.env.NEON_DATA_DIR ?? (process.env.VERCEL ? path.join(os.tmpdir(), "cyberblade-data") : ".data");
  const resolved = path.resolve(/* turbopackIgnore: true */ baseDir, name);
  const resolvedBase = path.resolve(/* turbopackIgnore: true */ baseDir);
  if (!resolved.startsWith(resolvedBase)) {
    throw new Error(`Path traversal attempt detected for file: ${name}`);
  }
  // Runtime data dir, not a build input: keep Turbopack from tracing the whole project.
  return path.join(/* turbopackIgnore: true */ baseDir, name);
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // Windows can briefly lock files (antivirus, indexers, cross-process writes).
      if (attempt >= 20 || (code !== "EPERM" && code !== "EBUSY")) {
        await fs.unlink(from).catch(() => undefined);
        throw err;
      }
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}

export function createJsonStore<T>(filePath: string, defaults: () => T): JsonStore<T> {
  const key = path.resolve(filePath);

  async function load(): Promise<T> {
    let raw: string;
    try {
      raw = await fs.readFile(key, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return defaults();
      throw err;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      await renameWithRetry(key, `${key}.corrupt-${Date.now()}`);
      return defaults();
    }
  }

  async function save(data: T): Promise<void> {
    await fs.mkdir(path.dirname(key), { recursive: true });
    const tmp = `${key}.${process.pid}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await renameWithRetry(tmp, key);
  }

  return {
    read: () => serialize(key, load),
    update: (fn) =>
      serialize(key, async () => {
        const data = await load();
        fn(data);
        await save(data);
        return data;
      }),
  };
}

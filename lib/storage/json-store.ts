import fs from "node:fs/promises";
import path from "node:path";

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
  // Runtime data dir, not a build input: keep Turbopack from tracing the whole project.
  return path.join(/* turbopackIgnore: true */ process.env.NEON_DATA_DIR ?? ".data", name);
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // Windows can briefly lock files (antivirus, indexers).
      if (attempt >= 5 || (code !== "EPERM" && code !== "EBUSY")) throw err;
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
    const tmp = `${key}.tmp`;
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

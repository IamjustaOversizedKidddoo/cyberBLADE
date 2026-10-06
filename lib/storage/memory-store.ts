import type { JsonStore } from "./json-store";

/** In-memory JsonStore with the same serialized-update semantics (tests). */
export function createMemoryStore<T>(defaults: () => T): JsonStore<T> {
  let data = defaults();
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <R>(task: () => R | Promise<R>): Promise<R> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };
  return {
    read: () => serialize(() => structuredClone(data)),
    update: (fn) =>
      serialize(() => {
        const draft = structuredClone(data);
        fn(draft);
        data = draft;
        return structuredClone(data);
      }),
  };
}

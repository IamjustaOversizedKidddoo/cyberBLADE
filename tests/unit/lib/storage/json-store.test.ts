import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createJsonStore, dataPath } from "@/lib/storage/json-store";

let dir: string;
let file: string;
const makeStore = () => createJsonStore<{ n: number }>(file, () => ({ n: 0 }));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "neon-store-"));
  file = path.join(dir, "db.json");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("missing file returns defaults", async () => {
  expect(await makeStore().read()).toEqual({ n: 0 });
});

test("update persists to disk", async () => {
  await makeStore().update((d) => { d.n = 5; });
  expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ n: 5 });
});

test("concurrent updates are not lost", async () => {
  const store = makeStore();
  await Promise.all(Array.from({ length: 20 }, () => store.update((d) => { d.n++; })));
  expect(await store.read()).toEqual({ n: 20 });
  expect(() => JSON.parse(fs.readFileSync(file, "utf8"))).not.toThrow();
});

test("two store instances on the same file share the lock", async () => {
  const a = makeStore();
  const b = makeStore();
  await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).update((d) => { d.n++; })));
  expect(await a.read()).toEqual({ n: 10 });
});

test("corrupt file is backed up and defaults used", async () => {
  fs.writeFileSync(file, "{half");
  expect(await makeStore().read()).toEqual({ n: 0 });
  expect(fs.readdirSync(dir).some((f) => f.startsWith("db.json.corrupt-"))).toBe(true);
});

test("creates missing directories", async () => {
  file = path.join(dir, "nested", "deeper", "db.json");
  await makeStore().update((d) => { d.n = 1; });
  expect(fs.existsSync(file)).toBe(true);
});

test("dataPath uses NEON_DATA_DIR, defaulting to .data", () => {
  const prev = process.env.NEON_DATA_DIR;
  delete process.env.NEON_DATA_DIR;
  expect(dataPath("x.json")).toBe(path.join(".data", "x.json"));
  process.env.NEON_DATA_DIR = "custom";
  expect(dataPath("x.json")).toBe(path.join("custom", "x.json"));
  if (prev === undefined) delete process.env.NEON_DATA_DIR; else process.env.NEON_DATA_DIR = prev;
});

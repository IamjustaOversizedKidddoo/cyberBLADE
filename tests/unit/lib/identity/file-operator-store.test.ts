import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileOperatorStore } from "@/lib/identity/file-operator-store";

let dir: string;
let store: FileOperatorStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "neon-ops-"));
  store = new FileOperatorStore(path.join(dir, "operators.json"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("create then get round-trips with rank 0", async () => {
  const op = await store.create({ handle: "ghost_01", ethicsAcceptedAt: "2026-10-07T00:00:00.000Z" });
  expect(op.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(op).toMatchObject({ handle: "ghost_01", rank: 0, ethicsAcceptedAt: "2026-10-07T00:00:00.000Z" });
  expect(await store.get(op.id)).toEqual(op);
});

test("get unknown id returns null", async () => {
  expect(await store.get("nope")).toBeNull();
});

test("setRank updates the operator", async () => {
  const op = await store.create({ handle: "ghost_01", ethicsAcceptedAt: "2026-10-07T00:00:00.000Z" });
  await store.setRank(op.id, 1);
  expect((await store.get(op.id))?.rank).toBe(1);
});

test("data survives a new store instance", async () => {
  const op = await store.create({ handle: "ghost_01", ethicsAcceptedAt: "2026-10-07T00:00:00.000Z" });
  const again = new FileOperatorStore(path.join(dir, "operators.json"));
  expect(await again.get(op.id)).toEqual(op);
});

import { formatFlag } from "@/lib/generators/flag";
import { createRng, newSeed } from "@/lib/generators/rng";

test("same seed, same sequence; different seed, different sequence", () => {
  expect(createRng("abc").hex(12)).toBe(createRng("abc").hex(12));
  expect(createRng("abc").hex(12)).not.toBe(createRng("abd").hex(12));
});

test("hex returns lowercase hex of the requested length", () => {
  expect(createRng("x").hex(12)).toMatch(/^[0-9a-f]{12}$/);
  expect(createRng("x").hex(40)).toMatch(/^[0-9a-f]{40}$/);
});

test("next() is in [0, 1)", () => {
  const rng = createRng("n");
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});

test("int(min, max) stays in range and hits both ends", () => {
  const rng = createRng("dice");
  const seen = new Set<number>();
  for (let i = 0; i < 10_000; i++) {
    const v = rng.int(1, 6);
    expect(Number.isInteger(v) && v >= 1 && v <= 6).toBe(true);
    seen.add(v);
  }
  expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test("pick and shuffle are deterministic and complete", () => {
  const xs = ["a", "b", "c", "d", "e"];
  expect(createRng("p").pick(xs)).toBe(createRng("p").pick(xs));
  const shuffled = createRng("s").shuffle(xs);
  expect([...shuffled].sort()).toEqual(xs);
  expect(xs).toEqual(["a", "b", "c", "d", "e"]);
  expect(createRng("s").shuffle(xs)).toEqual(shuffled);
});

test("newSeed is 16 random hex chars", () => {
  const a = newSeed();
  expect(a).toMatch(/^[0-9a-f]{16}$/);
  expect(newSeed()).not.toBe(a);
});

test("flag format", () => {
  expect(formatFlag("0123456789ab")).toBe("CYBERBLADE{0123456789ab}");
});

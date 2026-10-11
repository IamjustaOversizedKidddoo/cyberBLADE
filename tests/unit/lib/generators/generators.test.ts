import { describe, expect, it } from "vitest";
import { GENERATORS } from "@/lib/generators";
import { createRng } from "@/lib/generators/rng";

describe("generator property tests across all 20 generators", () => {
  const generatorEntries = Object.entries(GENERATORS);

  it("registers exactly 20 distinct generators", () => {
    expect(generatorEntries.length).toBe(20);
  });

  for (const [name, generator] of generatorEntries) {
    describe(`generator: ${name}`, () => {
      it("is strictly deterministic for the same seed", () => {
        const seed = "deterministic-seed-42";
        const out1 = generator(createRng(seed), {});
        const out2 = generator(createRng(seed), {});

        expect(out1.answers).toEqual(out2.answers);
        expect(JSON.stringify(out1.env)).toBe(JSON.stringify(out2.env));
      });

      it("produces valid, non-empty answers across multiple seeds", () => {
        for (let i = 0; i < 50; i++) {
          const seed = `seed-${name}-${i}`;
          const out = generator(createRng(seed), {});

          expect(out.answers).toBeDefined();
          const answerKeys = Object.keys(out.answers);
          expect(answerKeys.length).toBeGreaterThan(0);

          for (const [k, val] of Object.entries(out.answers)) {
            expect(typeof val).toBe("string");
            expect(val.trim().length).toBeGreaterThan(0);

            // If the answer is a flag, verify it has matching braces
            if (val.startsWith("CYBERBLADE{") || val.startsWith("NEON{")) {
              expect(val.endsWith("}")).toBe(true);
            }
          }

          // Verify env is populated
          expect(out.env).toBeDefined();
        }
      });
    });
  }
});

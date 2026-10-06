import { BRAND } from "@/lib/brand";

test("brand name is a single constant", () => {
  expect(BRAND.name).toBe("NEON");
  expect(BRAND.tagline).toMatch(/hacker game/);
});

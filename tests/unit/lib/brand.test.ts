import { BRAND } from "@/lib/brand";

test("the brand is CYBERBLADE, one constant", () => {
  expect(BRAND).toEqual({
    name: "CYBERBLADE",
    fullName: "Breach-Level Analysis of Digital Exploitation",
    tagline: "Learn. Breach. Analyze. Defend.",
  });
});

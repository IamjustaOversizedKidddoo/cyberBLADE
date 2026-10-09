import fs from "node:fs";

const css = fs.readFileSync("app/globals.css", "utf8");

test("band tones define their colours as tokens, and high contrast turns light bands dark", () => {
  for (const band of ["band-paper", "band-void", "band-cyan"]) expect(css).toMatch(new RegExp(`\\.${band}\\s*\\{[^}]*--band-bg:`));
  expect(css).toMatch(/\[data-contrast="high"\]\s*\.band-paper[^{]*\{[^}]*--band-bg:\s*#0b0f19/);
  expect(css).toMatch(/\[data-contrast="high"\][^{]*\.band-cyan[^{]*\{[^}]*--band-bg:\s*#0b0f19/);
});

test("poster type scale and layer order are tokens", () => {
  for (const token of ["--poster-hero", "--poster-section", "--poster-label", "--z-texture", "--z-art", "--z-type", "--z-ui"]) {
    expect(css).toContain(`${token}:`);
  }
});

test("composition utilities: the poster grid and small tilts that straighten on phones", () => {
  expect(css).toMatch(/\.poster-grid\s*\{/);
  expect(css).toMatch(/\.tilt-1\s*\{/);
  expect(css).toMatch(/@media \(max-width: 639px\)\s*\{[^}]*\.tilt-1/);
});

test("scroll scenes drive diagrams through data-step, and nothing changes without a scene", () => {
  expect(css).toMatch(/\[data-scene\]\[data-step="2"\][^{]*\[data-index="2"\]/);
  expect(css).toMatch(/\[data-scene\]\[data-step\][^{]*\.draw-path/);
});

test("both reduced-motion switches still exist", () => {
  expect(css).toContain('[data-motion="reduce"]');
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
});

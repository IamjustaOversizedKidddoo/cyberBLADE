import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Art system rule: pages and components use the motion primitives in components/art/motion/,
    // never the animation libraries directly (keeps GSAP and Motion separate and code-split).
    ignores: ["components/art/motion/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(gsap|@gsap/react|motion|three|lenis)(/.*)?$",
              message: "Use the primitives in components/art/motion/ (ScrollScene, Parallax, Reveal, Counter, Magnetic, MissionMarker).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

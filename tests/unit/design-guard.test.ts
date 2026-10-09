import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every .tsx file under the given folders, with its source. */
function sources(...dirs: string[]): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".tsx")) out.push({ file: path, text: readFileSync(path, "utf8") });
    }
  };
  dirs.forEach(walk);
  return out;
}

test("no control hides its focus outline without a visible focus-visible replacement", () => {
  const offenders = sources("app", "components").flatMap(({ file, text }) =>
    text
      .split("\n")
      .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
      .filter(({ line }) => line.includes("focus:outline-none") && !/focus-visible:(outline|ring|border)/.test(line))
      .map(({ at }) => at),
  );
  expect(offenders).toEqual([]);
});

test("lab UI uses the colour tokens, not raw hex values in class names", () => {
  const offenders = sources("components/labs").flatMap(({ file, text }) => [...text.matchAll(/-\[#[0-9a-fA-F]{3,8}\]/g)].map((m) => `${file}: ${m[0]}`));
  expect(offenders).toEqual([]);
});

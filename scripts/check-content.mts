/**
 * Content gate for CI: lesson structure, checks, labs, coverage matrix, and that every command a
 * lesson shows runs in the lab shell. Run with `npm run check:content`.
 */
import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseChecks, type CheckSet } from "@/lib/content/checks";
import { consoleCommands, runConsoleCommands } from "@/lib/content/lesson-commands";
import { loadLessons } from "@/lib/content/lessons";
import { coverageSchema, validateContent } from "@/lib/content/validate";
import { GENERATORS } from "@/lib/generators";
import { generateLab } from "@/lib/lab-engine/checks";
import { listLabs } from "@/lib/lab-engine/labs";
import { demoWorld } from "@/lib/lab-engine/terminal/demo-world";

async function main(): Promise<number> {
  const errors: string[] = [];
  const lessons = await loadLessons("content");
  const labs = await listLabs("labs");
  const labsById = new Map(labs.map((l) => [l.id, l]));

  const checks = new Map<string, CheckSet>();
  for (const lesson of lessons) {
    const file = lesson.filePath.replace(/\.mdx$/, ".checks.yaml");
    try {
      checks.set(lesson.id, parseChecks(await fs.readFile(file, "utf8"), file));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") errors.push((err as Error).message);
    }
  }

  const coverage = coverageSchema.parse(parseYaml(await fs.readFile("content/coverage/core.yaml", "utf8")));

  const result = await validateContent({
    lessons,
    checks,
    labs,
    coverage,
    generators: Object.keys(GENERATORS),
    runLessonCommands: (lesson) => {
      const lab = lesson.lab ? labsById.get(lesson.lab) : undefined;
      const world = lab && Object.hasOwn(GENERATORS, lab.dataset.generator) ? generateLab(lab, "content-check").world : demoWorld();
      return runConsoleCommands(consoleCommands(lesson.body), world);
    },
    now: new Date(),
  });
  errors.push(...result.errors);

  for (const w of result.warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) {
    console.error(`\n✗ content check failed: ${errors.length} error(s)`);
    return 1;
  }
  console.log(`✓ content OK — ${lessons.length} lessons, ${labs.length} labs, ${coverage.objectives.length} objectives`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`✗ content check crashed: ${(err as Error).message}`);
    process.exit(1);
  },
);

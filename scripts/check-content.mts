/**
 * Content gate for CI: lesson structure, checks, labs, coverage matrix, and that every command a
 * lesson shows runs in the lab shell. Run with `npm run check:content`.
 */
import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseChecks, type CheckSet } from "@/lib/content/checks";
import { consoleCommands, consoleExamples, outputMismatches, runConsoleCommands } from "@/lib/content/lesson-commands";
import { loadLessons } from "@/lib/content/lessons";
import { DRILL_MIN_RANK } from "@/app/(app)/practice/drills/rank";
import { parseExercises } from "@/lib/content/exercises";
import { resolvePracticeTarget } from "@/lib/content/practice";
import { keyTermsOf, lintSocLesson, prerequisiteGraphErrors } from "@/lib/content/soc-lesson-lint";
import { loadPracticePaths } from "@/lib/content/soc-curriculum";
import { loadGeneratorMarkers } from "@/lib/content/soc-markers";
import { loadLessonCards, loadSocCoverage, loadTrackConfig, renderTrackCardsModule, socCoverageErrors } from "@/lib/content/soc-track";
import { coverageSchema, validateContent } from "@/lib/content/validate";
import { GENERATORS } from "@/lib/generators";
import { generateLab } from "@/lib/lab-engine/checks";
import { listLabs } from "@/lib/lab-engine/labs";
import { demoWorld } from "@/lib/lab-engine/terminal/demo-world";

async function loadExercisesFile(lessonFile: string) {
  const file = lessonFile.replace(/\.mdx$/, ".exercises.yaml");
  try {
    return parseExercises(await fs.readFile(file, "utf8"), file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

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
  const socCoverage = loadSocCoverage();

  const result = await validateContent({
    lessons,
    checks,
    labs,
    coverage,
    extraObjectiveIds: new Set(socCoverage.skills.map((s) => `soc:${s.id}`)),
    generators: Object.keys(GENERATORS),
    runLessonCommands: (lesson) => {
      const lab = lesson.lab ? labsById.get(lesson.lab) : undefined;
      let world = demoWorld();
      if (lab && Object.hasOwn(GENERATORS, lab.dataset.generator)) {
        const out = generateLab(lab, "content-check");
        if (out.env.kind === "terminal") world = out.env.world;
      }
      // Commands must run in the lesson's own lab world; shown outputs are written against the demo machine.
      return [
        ...runConsoleCommands(consoleCommands(lesson.body), world),
        ...outputMismatches(consoleExamples(lesson.body), demoWorld()),
      ];
    },
    now: new Date(),
  });
  // Validate SOC scenarios
  try {
    const socDir = "content/soc/scenarios";
    const socFiles = (await fs.readdir(socDir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    for (const sf of socFiles) {
      const { validateSocScenario } = await import("@/lib/lab-engine/soc/validator");
      const socContent = await fs.readFile(`${socDir}/${sf}`, "utf8");
      const socRes = validateSocScenario(parseYaml(socContent), sf);
      errors.push(...socRes.errors);
      for (const w of socRes.warnings) console.warn(`warning: ${w}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(`failed to check soc scenarios: ${(err as Error).message}`);
    }
  }

  // Validate SOC scenario families
  try {
    const famDir = "content/soc/families";
    const famFiles = (await fs.readdir(famDir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    for (const ff of famFiles) {
      const { socFamilySchema } = await import("@/lib/lab-engine/soc/family-schema");
      const { runFamilyProof } = await import("@/lib/lab-engine/soc/family-validator");
      const famContent = await fs.readFile(`${famDir}/${ff}`, "utf8");
      const famParsed = socFamilySchema.safeParse(parseYaml(famContent));
      if (!famParsed.success) {
        errors.push(`failed to parse soc family ${ff}: ${famParsed.error.message}`);
      } else {
        const proofRes = runFamilyProof(famParsed.data, 20, "intermediate");
        if (proofRes.verdict !== "PASSED") {
          errors.push(`SOC family ${ff} proof failed: ${proofRes.weakestAreas.join("; ")}`);
        }
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(`failed to check soc families: ${(err as Error).message}`);
    }
  }

  errors.push(...result.errors);

  // SOC L1 track lessons: template, leak scan, indicators, time, prerequisites, coverage, cards.
  const socWarnings: string[] = [];
  const socLessons = lessons.filter((l) => l.track === "soc");
  if (socLessons.length) {
    const track = loadTrackConfig();
    const skillsDoc = parseYaml(await fs.readFile("content/soc/skills.yaml", "utf8")) as { skills: Array<{ id: string }> };
    const skillIds = new Set(skillsDoc.skills.map((s) => s.id));
    const titles = new Map(lessons.map((l) => [l.id, l.title]));
    const practiceError = (t: string) => {
      const r = resolvePracticeTarget(t, (id) => titles.get(id) ?? null);
      return typeof r === "string" ? r : null;
    };
    const markers = loadGeneratorMarkers();
    const cardEntries = [];
    const termOwner = new Map<string, { lesson: string; definition: string }>();
    for (const lesson of socLessons) {
      let exercises = null;
      let cards = null;
      try {
        exercises = await loadExercisesFile(lesson.filePath);
      } catch (err) {
        errors.push((err as Error).message);
      }
      try {
        const c = loadLessonCards(lesson.filePath);
        if (c) {
          if (c.lesson !== lesson.id) errors.push(`${lesson.id}: cards file says lesson ${c.lesson}`);
          cards = c.cards;
          cardEntries.push({ lessonId: lesson.id, rank: track.min_core_rank, cards: c.cards });
        }
      } catch (err) {
        errors.push((err as Error).message);
      }
      const r = lintSocLesson({
        lesson,
        checks: checks.get(lesson.id),
        exercises,
        cards,
        skillIds,
        moduleKeys: new Set(track.modules.map((m) => m.key)),
        minCoreRank: track.min_core_rank,
        practiceError,
        markers,
      });
      errors.push(...r.errors);
      socWarnings.push(...r.warnings);
      for (const t of keyTermsOf(lesson.body)) {
        const key = t.term.toLowerCase();
        const prev = termOwner.get(key);
        if (prev) errors.push(`${lesson.id}: key term "${t.term}" is already defined in ${prev.lesson}; link to it instead of redefining`);
        else termOwner.set(key, { lesson: lesson.id, definition: t.definition });
      }
    }
    errors.push(...prerequisiteGraphErrors(lessons, track.min_core_rank));
    if (DRILL_MIN_RANK !== track.min_core_rank) errors.push(`practice/drills/rank.ts DRILL_MIN_RANK ${DRILL_MIN_RANK} must equal track min_core_rank ${track.min_core_rank}`);
    errors.push(...socCoverageErrors(socCoverage, socLessons, skillIds, practiceError));
    try {
      const socIds = new Set(socLessons.map((l) => l.id));
      for (const pth of loadPracticePaths().paths) {
        for (const step of pth.steps) {
          if ("lesson" in step && !socIds.has(step.lesson)) errors.push(`paths.yaml ${pth.id}: unknown SOC lesson ${step.lesson}`);
          if ("practice" in step) {
            const problem = practiceError(step.practice);
            if (problem) errors.push(`paths.yaml ${pth.id}: practice ${step.practice}: ${problem}`);
          }
        }
      }
    } catch (err) {
      errors.push(`paths.yaml: ${(err as Error).message}`);
    }
    const expectedCards = renderTrackCardsModule(cardEntries);
    const actualCards = await fs.readFile("lib/review/track-cards.generated.ts", "utf8").catch(() => "");
    if (actualCards.replace(/\r\n/g, "\n") !== expectedCards) errors.push("lib/review/track-cards.generated.ts is out of date: run npm run soc:curriculum -- cards");
  }

  for (const w of [...result.warnings, ...socWarnings]) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) {
    console.error(`\n✗ content check failed: ${errors.length} error(s)`);
    return 1;
  }
  console.log(`✓ content OK — ${lessons.length} lessons, ${labs.length} labs, ${coverage.objectives.length} objectives, SOC scenarios validated`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`✗ content check crashed: ${(err as Error).message}`);
    process.exit(1);
  },
);

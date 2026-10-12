import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { loadLessons } from "../lib/content/lessons";
import { listLabs } from "../lib/lab-engine/labs";
import { parseChecks, type CheckSet } from "../lib/content/checks";
import { consoleCommands } from "../lib/content/lesson-commands";

async function runAudit() {
  const lessons = await loadLessons("content");
  const labs = await listLabs("labs");
  const labsById = new Map(labs.map(l => [l.id, l]));

  const lessonChecks = new Map<string, CheckSet>();
  for (const lesson of lessons) {
    const file = lesson.filePath.replace(/\.mdx$/, ".checks.yaml");
    try {
      const raw = await fs.readFile(file, "utf8");
      lessonChecks.set(lesson.id, parseChecks(raw, file));
    } catch {
      // ignore
    }
  }

  // 1. Reading time, words, checks
  interface LessonStat {
    id: string;
    title: string;
    rank: number;
    module: string;
    order: number;
    words: number;
    readTimeMin: number;
    checksCount: number;
    labId?: string;
    commandsShown: string[];
  }

  const lessonStats: LessonStat[] = [];
  const learnedCommandsByOrder: { orderIndex: number; commands: Set<string> }[] = [];
  const allKnownCommands = new Set<string>();

  let cumulativeIndex = 0;
  for (const l of lessons) {
    const words = l.body.trim().split(/\s+/).filter(Boolean).length;
    const readTimeMin = Math.round((words / 200) * 10) / 10;
    const checks = lessonChecks.get(l.id);
    const checksCount = checks ? checks.questions.length : 0;
    const commandsShown = Array.from(new Set(consoleCommands(l.body)));

    for (const cmd of commandsShown) {
      allKnownCommands.add(cmd.trim().split(/\s+/)[0]);
    }

    lessonStats.push({
      id: l.id,
      title: l.title,
      rank: l.rank,
      module: l.module,
      order: l.order,
      words,
      readTimeMin,
      checksCount,
      labId: l.lab ?? undefined,
      commandsShown
    });

    cumulativeIndex++;
  }

  // 2. Labs audit
  interface LabStat {
    id: string;
    title: string;
    kind: string;
    objectivesCount: number;
    rank?: number;
    associatedLesson?: string;
    briefingWords: number;
  }

  const labStats: LabStat[] = labs.map(lab => {
    const briefingWords = lab.briefingText.trim().split(/\s+/).filter(Boolean).length;
    return {
      id: lab.id,
      title: lab.title,
      kind: lab.type,
      objectivesCount: lab.objectives.length,
      associatedLesson: lessons.find(l => l.lab === lab.id)?.id,
      briefingWords
    };
  });

  // Labs per module
  const labsByModule = new Map<string, number>();
  for (const l of lessons) {
    if (l.lab) {
      labsByModule.set(l.module, (labsByModule.get(l.module) || 0) + 1);
    }
  }

  // 3. Item analysis of check questions
  // Position bias, longest-answer bias, near-duplicate stems, missing/thin explanations
  let totalQuestions = 0;
  const positionBias = [0, 0, 0, 0, 0];
  let longestAnswerCorrectCount = 0;
  let questionsWithThinExplanation = 0; // explanation < 20 chars
  const allStems: { id: string; prompt: string; lessonId: string }[] = [];

  for (const [lessonId, checkSet] of lessonChecks.entries()) {
    for (const q of checkSet.questions) {
      totalQuestions++;
      allStems.push({ id: q.id, prompt: q.prompt, lessonId });

      const correctIndex = q.options.findIndex(o => o.correct);
      if (correctIndex >= 0 && correctIndex < positionBias.length) {
        positionBias[correctIndex]++;
      }

      // Longest answer
      let maxLen = -1;
      let maxIdx = -1;
      q.options.forEach((opt, idx) => {
        if (opt.text.length > maxLen) {
          maxLen = opt.text.length;
          maxIdx = idx;
        }
      });
      if (maxIdx === correctIndex) {
        longestAnswerCorrectCount++;
      }

      // Explanations check
      for (const opt of q.options) {
        if (!opt.explanation || opt.explanation.length < 20) {
          questionsWithThinExplanation++;
          break;
        }
      }
    }
  }

  // Near duplicate stems check
  const duplicateStems: { stem1: string; stem2: string; l1: string; l2: string; sim: number }[] = [];
  for (let i = 0; i < allStems.length; i++) {
    for (let j = i + 1; j < allStems.length; j++) {
      const s1 = allStems[i].prompt.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const s2 = allStems[j].prompt.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      if (s1 === s2) {
        duplicateStems.push({ stem1: allStems[i].id, stem2: allStems[j].id, l1: allStems[i].lessonId, l2: allStems[j].lessonId, sim: 1 });
      }
    }
  }

  // 4. Output results as JSON for consumption
  const report = {
    totalLessons: lessons.length,
    totalLabs: labs.length,
    totalQuestions,
    positionBias,
    longestAnswerCorrectCount,
    longestAnswerCorrectPct: Math.round((longestAnswerCorrectCount / totalQuestions) * 100),
    questionsWithThinExplanation,
    duplicateStems,
    lessonStats,
    labStats,
    labsByModule: Object.fromEntries(labsByModule)
  };

  await fs.writeFile(
    path.join(process.cwd(), "scripts", "learning-audit-result.json"),
    JSON.stringify(report, null, 2)
  );
  console.log("Audit written to scripts/learning-audit-result.json");
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});

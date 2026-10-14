/**
 * SOC L1 curriculum helpers. `npm run soc:curriculum -- times` prints computed lesson times
 * (add `--write` to set each lesson's estimated_minutes to its computed time);
 * `npm run soc:curriculum -- cards` regenerates lib/review/track-cards.generated.ts from the .cards.yaml files.
 */
import fs from "node:fs";
import { parseChecks } from "@/lib/content/checks";
import { loadLessons } from "@/lib/content/lessons";
import { computeLessonTime } from "@/lib/content/soc-lesson-lint";
import { loadLessonCards, loadTrackConfig, renderTrackCardsModule } from "@/lib/content/soc-track";

export const TRACK_CARDS_FILE = "lib/review/track-cards.generated.ts";

async function main(): Promise<number> {
  const cmd = process.argv[2];
  const lessons = (await loadLessons("content")).filter((l) => l.track === "soc");
  if (cmd === "times") {
    for (const l of lessons) {
      const file = l.filePath.replace(/\.mdx$/, ".checks.yaml");
      const checks = fs.existsSync(file) ? parseChecks(fs.readFileSync(file, "utf8"), file) : undefined;
      const t = computeLessonTime(l, checks);
      let flag = t.minutes === l.estimated_minutes ? "ok" : `MISMATCH (frontmatter ${l.estimated_minutes})`;
      if (flag !== "ok" && process.argv.includes("--write")) {
        const src = fs.readFileSync(l.filePath, "utf8");
        fs.writeFileSync(l.filePath, src.replace(/^estimated_minutes: \d+$/m, `estimated_minutes: ${t.minutes}`));
        flag = `written (was ${l.estimated_minutes})`;
      }
      console.log(`${l.id}: ${t.minutes} min = ${t.words} words/200 + ${t.exercises}×3 + ${t.checks}×1 + ${t.diagrams}×0.5 — ${flag}`);
    }
    return 0;
  }
  if (cmd === "cards") {
    const rank = loadTrackConfig().min_core_rank;
    const entries = lessons.flatMap((l) => {
      const c = loadLessonCards(l.filePath);
      return c ? [{ lessonId: l.id, rank, cards: c.cards }] : [];
    });
    fs.writeFileSync(TRACK_CARDS_FILE, renderTrackCardsModule(entries));
    console.log(`wrote ${TRACK_CARDS_FILE} (${entries.reduce((n, e) => n + e.cards.length, 0)} cards)`);
    return 0;
  }
  console.error("usage: soc-curriculum (times|cards)");
  return 1;
}

main().then((c) => process.exit(c));

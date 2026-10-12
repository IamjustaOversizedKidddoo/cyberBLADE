import fs from "node:fs/promises";
import { loadLessons } from "../lib/content/lessons";
import { listLabs } from "../lib/lab-engine/labs";

async function checkPrereqs() {
  const lessons = await loadLessons("content");
  const labs = await listLabs("labs");

  console.log("Analyzing lesson and lab prerequisites...");

  // Map each lab to its associated lesson order
  const labToLesson = new Map();
  for (const l of lessons) {
    if (l.lab) {
      labToLesson.set(l.lab, l);
    }
  }

  // Look at labs without an associated lesson (e.g. challenges, standalone labs)
  const unlinkedLabs = labs.filter(lab => !labToLesson.has(lab.id));
  console.log("Unlinked labs (capstones / standalone):", unlinkedLabs.map(l => l.id));

  // Check commands introduced per lesson
  const commandsTaughtByLesson: { [lessonId: string]: string[] } = {};
  for (const l of lessons) {
    const lines = l.body.split("\n");
    const cmds: string[] = [];
    for (const line of lines) {
      const match = line.match(/^```(?:bash|sh|console|powershell)?\s*\n([\s\S]*?)```/m);
      // or simple inline / blocks
      if (line.startsWith("$ ")) {
        cmds.push(line.slice(2).trim().split(/\s+/)[0]);
      }
    }
    commandsTaughtByLesson[l.id] = Array.from(new Set(cmds));
  }

  // Print summary of lab objectives
  console.log("\nLab Objectives counts:");
  for (const lab of labs) {
    console.log(`- ${lab.id} (${lab.type}): ${lab.objectives.length} objectives, ${lab.estimated_minutes} min, ${lab.xp} XP`);
  }
}

checkPrereqs().catch(console.error);

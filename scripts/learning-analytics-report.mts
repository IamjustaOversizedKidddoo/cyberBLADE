import fs from "node:fs/promises";
import path from "node:path";
import type { ProgressData } from "../lib/progress/types.js";

async function main() {
  const filePath = path.join(process.cwd(), ".data", "progress.json");
  let data: ProgressData = { lessons: {}, attempts: {}, xp: {}, challenges: {} };

  try {
    const raw = await fs.readFile(filePath, "utf8");
    data = JSON.parse(raw);
  } catch {
    console.log("No existing .data/progress.json found. Displaying baseline structure.");
  }

  const lessonsCount = Object.keys(data.lessons || {}).length;
  const completedLessons = Object.values(data.lessons || {}).filter((l) => l.status === "completed").length;
  const totalChecksPassed = Object.values(data.lessons || {}).reduce((sum, l) => sum + (l.checksPassed?.length || 0), 0);

  const attempts = Object.values(data.attempts || {});
  const completedAttempts = attempts.filter((a) => a.completedAt !== null).length;
  const failedAttempts = attempts.filter((a) => a.failedAt !== null).length;

  const reviewItems = Object.values(data.reviewItems || {});
  const reviewEvents = Object.values(data.reviewEvents || {});
  const examReports = Object.values(data.examReports || {});

  const gradeDistribution = {
    again: reviewEvents.filter((e) => e.grade === 1).length,
    hard: reviewEvents.filter((e) => e.grade === 3).length,
    good: reviewEvents.filter((e) => e.grade === 4).length,
    easy: reviewEvents.filter((e) => e.grade === 5).length,
  };

  console.log("===============================================================================");
  console.log("CYBERBLADE PRIVACY-PRESERVING LEARNING EFFECTIVENESS REPORT");
  console.log("===============================================================================");
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("Privacy Guarantee: Aggregated operational telemetry. Zero PII, IPs, or tokens.");
  console.log("-------------------------------------------------------------------------------");
  console.log(`Curriculum Missions:`);
  console.log(`  - Total Initiated: ${lessonsCount}`);
  console.log(`  - Total Completed: ${completedLessons}`);
  console.log(`  - Completion Rate: ${lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0}%`);
  console.log(`  - Checks Passed:   ${totalChecksPassed}`);
  console.log("-------------------------------------------------------------------------------");
  console.log(`Hands-on Labs:`);
  console.log(`  - Total Attempts:  ${attempts.length}`);
  console.log(`  - Lab Solved:      ${completedAttempts}`);
  console.log(`  - Lab Failed/Exp:  ${failedAttempts}`);
  console.log("-------------------------------------------------------------------------------");
  console.log(`Spaced Retrieval Repetition (SM-2):`);
  console.log(`  - Tracked Cards:   ${reviewItems.length}`);
  console.log(`  - Total Reviews:   ${reviewEvents.length}`);
  console.log(`  - Grade Ratings:   Again=${gradeDistribution.again}, Hard=${gradeDistribution.hard}, Good=${gradeDistribution.good}, Easy=${gradeDistribution.easy}`);
  console.log("-------------------------------------------------------------------------------");
  console.log(`External Exam Self-Reports:`);
  console.log(`  - Reports Logged:  ${examReports.length}`);
  console.log(`  - Passed Exams:    ${examReports.filter((r) => r.passed).length}`);
  console.log("===============================================================================");
}

void main();

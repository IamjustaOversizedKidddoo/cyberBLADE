/**
 * XP Economy & Learning Pacing Simulator
 *
 * Models learner progression across Ranks 0, 1, and 2 for three standard personas:
 * 1. Intensive / Accelerated Learner (60–90 min/day, 3 lessons/day)
 * 2. Consistent / Core Learner (30–45 min/day, 1 lesson/day)
 * 3. Casual / Slower Learner (15–20 min/day, 2 lessons/week)
 */

interface CohortConfig {
  name: string;
  dailyStudyMinutes: number;
  lessonsPerDay: number;
  reviewCardsPerDay: number;
  labRetryProbability: number;
}

const COHORTS: CohortConfig[] = [
  {
    name: "Fast / Accelerated Learner",
    dailyStudyMinutes: 75,
    lessonsPerDay: 3.0,
    reviewCardsPerDay: 10,
    labRetryProbability: 0.05,
  },
  {
    name: "Average / Consistent Learner",
    dailyStudyMinutes: 35,
    lessonsPerDay: 1.0,
    reviewCardsPerDay: 8,
    labRetryProbability: 0.20,
  },
  {
    name: "Casual / Slower Learner",
    dailyStudyMinutes: 15,
    lessonsPerDay: 0.35, // ~2.5 lessons per week
    reviewCardsPerDay: 5,
    labRetryProbability: 0.40,
  },
];

// Core Curriculum Milestones
// Rank 0: 6 lessons, 2 labs, 1 challenge (~450 XP)
// Rank 1: 18 lessons, 8 labs, 1 challenge (~1,450 XP)
// Rank 2: 14 lessons, 10 labs, 1 challenge (~1,300 XP)
// Total curriculum: 38 lessons, 20 labs, 3 challenges (~3,200 XP)
const RANK_0_LESSONS = 6;
const RANK_1_LESSONS = 18;
const RANK_2_LESSONS = 14;

const RANK_0_XP = 450;
const RANK_1_XP = 1450;
const RANK_2_XP = 1300;

const REVIEW_XP_PER_CARD = 5;
const MAX_DAILY_REVIEW_XP = 50;

function simulateCohort(cohort: CohortConfig) {
  let day = 0;
  let totalLessonsDone = 0;
  let totalXp = 0;

  let daysToRank1: number | null = null;
  let daysToRank2: number | null = null;
  let daysToFullCompletion: number | null = null;

  while (totalLessonsDone < (RANK_0_LESSONS + RANK_1_LESSONS + RANK_2_LESSONS) && day < 365) {
    day++;

    // Lessons progress
    totalLessonsDone += cohort.lessonsPerDay;

    // Review XP
    const reviewXpToday = Math.min(
      MAX_DAILY_REVIEW_XP,
      cohort.reviewCardsPerDay * REVIEW_XP_PER_CARD,
    );
    totalXp += reviewXpToday;

    // Check rank 1 unlock (after Rank 0 complete + 1 day for challenge)
    if (daysToRank1 === null && totalLessonsDone >= RANK_0_LESSONS) {
      daysToRank1 = day + 1; // +1 day for challenge attempt
      totalXp += RANK_0_XP;
    }

    // Check rank 2 unlock (after Rank 1 complete + 1 day for challenge)
    if (daysToRank2 === null && totalLessonsDone >= (RANK_0_LESSONS + RANK_1_LESSONS)) {
      daysToRank2 = day + 1;
      totalXp += RANK_1_XP;
    }

    // Check full completion
    if (daysToFullCompletion === null && totalLessonsDone >= (RANK_0_LESSONS + RANK_1_LESSONS + RANK_2_LESSONS)) {
      daysToFullCompletion = day + 1;
      totalXp += RANK_2_XP;
    }
  }

  return {
    cohort: cohort.name,
    dailyMinutes: cohort.dailyStudyMinutes,
    daysToRank1: daysToRank1 ?? 0,
    daysToRank2: daysToRank2 ?? 0,
    daysToCompletion: daysToFullCompletion ?? 0,
    finalXp: totalXp,
  };
}

console.log("===============================================================================");
console.log("CYBERBLADE XP ECONOMY & LEARNING PACING SIMULATION");
console.log("===============================================================================");
const results = COHORTS.map(simulateCohort);
console.table(results);

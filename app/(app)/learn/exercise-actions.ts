"use server";

/**
 * Checks a lesson micro-exercise answer on the server. Accepted answers never reach the browser;
 * the explanation is revealed only after a correct answer. Formative: no XP.
 */
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { canAccessRank } from "@/lib/progress/access";
import { getLesson } from "@/lib/content/lessons";
import { loadExercises } from "@/lib/content/exercises-server";
import { isAcceptedAnswer } from "@/lib/content/exercises";

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export interface ExerciseCheckResult {
  correct: boolean;
  explanation: string | null;
}

export async function checkLessonExerciseAction(
  lessonId: string,
  exerciseId: string,
  questionId: string,
  answer: string,
): Promise<ExerciseCheckResult> {
  const operator = await requireOperator();
  const [lid, eid, qid] = [slug.parse(lessonId), slug.parse(exerciseId), slug.parse(questionId)];
  const value = z.string().max(500).parse(answer);
  const rate = await rateLimit(`lesson_exercise:${operator.id}`, 30, 60_000);
  if (!rate.allowed) throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);

  const lesson = await getLesson(lid);
  if (!lesson || !canAccessRank(operator.rank, lesson.rank)) throw new Error("Exercise not available.");
  const set = await loadExercises(lid);
  const question = set?.exercises.find((e) => e.id === eid)?.questions.find((q) => q.id === qid);
  if (!question) throw new Error("Exercise not available.");

  const correct = isAcceptedAnswer(question, value);
  return { correct, explanation: correct ? question.explanation : null };
}

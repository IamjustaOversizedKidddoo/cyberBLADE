"use server";

/**
 * Module checkpoint answers. Graded on the server against the lessons' own check sets (answer keys
 * never reach the browser). Formative: nothing is recorded and no XP is awarded.
 */
import { z } from "zod";
import type { CheckResult } from "@/components/lesson/TerminalCheck";
import { gradeCheck } from "@/lib/content/checks";
import { loadChecks } from "@/lib/content/checks-server";
import { getLesson } from "@/lib/content/lessons";
import { splitCheckpointId } from "@/lib/content/soc-curriculum";
import { loadTrackConfig } from "@/lib/content/soc-track";
import { requireOperator } from "@/lib/identity/session";
import { canAccessRank } from "@/lib/progress/access";
import { rateLimit } from "@/lib/security/rate-limit";

const moduleKey = z.string().regex(/^[a-z]{2,12}$/);

export async function answerCheckpointAction(module: string, checkpointId: string, optionIndex: number): Promise<CheckResult> {
  const operator = await requireOperator();
  const key = moduleKey.parse(module);
  const index = z.number().int().min(0).max(9).parse(optionIndex);
  const ids = splitCheckpointId(z.string().max(120).parse(checkpointId));
  if (!ids) throw new Error("Checkpoint question not available.");
  const track = loadTrackConfig();
  if (!track.enabled || !canAccessRank(operator.rank, track.min_core_rank)) throw new Error("Checkpoint not available.");
  const rate = await rateLimit(`soc_checkpoint:${operator.id}`, 40, 60_000);
  if (!rate.allowed) throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);

  const lesson = await getLesson(ids.lessonId);
  if (!lesson || lesson.track !== "soc" || lesson.module !== key) throw new Error("Checkpoint question not available.");
  const set = await loadChecks(lesson.id);
  if (!set.questions.some((q) => q.id === ids.questionId)) throw new Error("Checkpoint question not available.");
  const r = gradeCheck(set, ids.questionId, index, operator.id);
  return { correct: r.correct, explanations: r.explanations, lessonCompleted: false };
}

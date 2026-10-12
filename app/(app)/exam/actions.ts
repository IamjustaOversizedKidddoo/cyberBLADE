"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { recordLearningEvent } from "@/lib/analytics/learning-events";

const reportSchema = z.object({
  examType: z.string().min(2).max(100),
  score: z.coerce.number().int().min(0).max(10000),
  maxScore: z.coerce.number().int().min(1).max(10000),
  passed: z.boolean(),
  notes: z.string().max(500).optional(),
});

export async function submitExamReportAction(input: {
  examType: string;
  score: number;
  maxScore: number;
  passed: boolean;
  notes?: string;
}) {
  const data = reportSchema.parse(input);
  const operator = await requireOperator();
  const ctx = getCtx();
  const now = ctx.now();

  const report = await ctx.repo.saveExamReport({
    userId: operator.id,
    examType: data.examType,
    score: data.score,
    maxScore: data.maxScore,
    passed: data.passed,
    notes: data.notes ?? null,
    reportedAt: now.toISOString(),
  });

  await recordLearningEvent(ctx, operator.id, "exam_self_report", {
    examType: data.examType,
    passed: data.passed,
    scorePercent: Math.round((data.score / data.maxScore) * 100),
  });

  revalidatePath("/exam");
  return { success: true, reportId: report.id };
}

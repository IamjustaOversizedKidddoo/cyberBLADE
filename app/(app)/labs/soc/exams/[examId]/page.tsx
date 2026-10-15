import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { isSocExamsEnabled } from "@/lib/config/env";
import { getExamState } from "@/lib/lab-engine/soc/exam/service";
import { socSkillTitle } from "@/lib/lab-engine/soc/exam/study-plan";
import { ExamRunner } from "@/components/labs/soc/exams/ExamRunner";
import { ExamResultView } from "@/components/labs/soc/exams/ExamResultView";
import { SocLabReview } from "@/components/labs/soc/exams/SocLabReview";

export const metadata: Metadata = { title: "SOC Practice Exam · CyberBLADE" };

export default async function SocExamPage(props: { params: Promise<{ examId: string }>; searchParams: Promise<{ review?: string }> }) {
  if (!isSocExamsEnabled()) notFound();
  const { examId } = await props.params;
  const { review } = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(examId)) notFound();
  const operator = await requireOperator();
  const state = await getExamState(getCtx(), operator.id, examId).catch(() => null);
  if (!state) notFound();

  if (state.status === "active") return <ExamRunner initial={state} />;
  // After submission only: the learner's own alerts, debriefs and model report in the workspace.
  if (review === "1" && state.socAttemptId) return <SocLabReview attemptId={state.socAttemptId} backHref={`/labs/soc/exams/${state.examId}`} />;

  const skillTitles = Object.fromEntries((state.result?.perSkill ?? []).map((s) => [s.skill, socSkillTitle(s.skill)]));
  return (
    <main>
      <ExamResultView state={state} skillTitles={skillTitles} />
    </main>
  );
}

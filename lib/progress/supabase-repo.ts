import "server-only";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProgressRepo } from "./repo";
import type { Database } from "@/lib/supabase/types";
import type {
  AttemptMode,
  LabAttempt,
  LessonProgress,
  RankChallenge,
  XpEvent,
  ReviewItemRecord,
  ReviewEventRecord,
  LearningEventRecord,
  ExamReportRecord,
} from "./types";
import type {
  SocAttemptRecord,
  SocDecisionRecord,
  SocCaseRecord,
  SocEvaluationResult,
} from "@/lib/lab-engine/soc/types";

export class SupabaseProgressRepo implements ProgressRepo {
  private async getClient() {
    const admin = createAdminClient();
    if (admin) return admin;
    const client = await createServerSupabaseClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  }

  // ---------------------------------------------------------------------------
  // Lessons
  // ---------------------------------------------------------------------------
  async getLessonProgress(userId: string, lessonId: string): Promise<LessonProgress | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("lesson_progress")
      .select("user_id, lesson_id, status, checks_passed, completed_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      lessonId: data.lesson_id,
      status: data.status,
      checksPassed: data.checks_passed ?? [],
      completedAt: data.completed_at,
    };
  }

  async listLessonProgress(userId: string): Promise<LessonProgress[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("lesson_progress")
      .select("user_id, lesson_id, status, checks_passed, completed_at")
      .eq("user_id", userId);

    if (error || !data) return [];

    return data.map((d) => ({
      userId: d.user_id,
      lessonId: d.lesson_id,
      status: d.status,
      checksPassed: d.checks_passed ?? [],
      completedAt: d.completed_at,
    }));
  }

  async addCheckPassed(userId: string, lessonId: string, questionId: string): Promise<LessonProgress> {
    const client = await this.getClient();
    const current = await this.getLessonProgress(userId, lessonId);

    const checksPassed = current
      ? Array.from(new Set([...current.checksPassed, questionId]))
      : [questionId];

    const { data, error } = await client
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          status: "in_progress",
          checks_passed: checksPassed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      )
      .select("user_id, lesson_id, status, checks_passed, completed_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update lesson check in Supabase: ${error?.message}`);
    }

    return {
      userId: data.user_id,
      lessonId: data.lesson_id,
      status: data.status,
      checksPassed: data.checks_passed ?? [],
      completedAt: data.completed_at,
    };
  }

  async touchLesson(userId: string, lessonId: string): Promise<void> {
    const client = await this.getClient();
    await client
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          status: "in_progress",
          checks_passed: [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      );
  }

  async markLessonCompleted(userId: string, lessonId: string, at: string): Promise<void> {
    const client = await this.getClient();
    const current = await this.getLessonProgress(userId, lessonId);

    await client
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          status: "completed",
          checks_passed: current?.checksPassed ?? [],
          completed_at: at,
          updated_at: at,
        },
        { onConflict: "user_id,lesson_id" },
      );
  }

  // ---------------------------------------------------------------------------
  // Lab Attempts
  // ---------------------------------------------------------------------------
  async getAttempt(id: string): Promise<LabAttempt | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("lab_attempts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      labId: data.lab_id,
      seed: data.seed,
      mode: data.mode,
      objectivesSolved: data.objectives_solved ?? [],
      hintsUsed: data.hints_used,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      completedAt: data.completed_at,
      failedAt: data.failed_at,
    };
  }

  async findLatestAttempt(userId: string, labId: string, mode: AttemptMode): Promise<LabAttempt | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("lab_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("lab_id", labId)
      .eq("mode", mode)
      .is("failed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      labId: data.lab_id,
      seed: data.seed,
      mode: data.mode,
      objectivesSolved: data.objectives_solved ?? [],
      hintsUsed: data.hints_used,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      completedAt: data.completed_at,
      failedAt: data.failed_at,
    };
  }

  async hasCompletedAttempt(userId: string, labId: string, mode: AttemptMode): Promise<boolean> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("lab_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("lab_id", labId)
      .eq("mode", mode)
      .not("completed_at", "is", null)
      .limit(1);

    if (error || !data) return false;
    return data.length > 0;
  }

  async createAttempt(attempt: Omit<LabAttempt, "id">): Promise<LabAttempt> {
    const client = await this.getClient();
    const id = randomUUID();

    const { data, error } = await client
      .from("lab_attempts")
      .insert({
        id,
        user_id: attempt.userId,
        lab_id: attempt.labId,
        seed: attempt.seed,
        mode: attempt.mode,
        objectives_solved: attempt.objectivesSolved,
        hints_used: attempt.hintsUsed,
        started_at: attempt.startedAt,
        expires_at: attempt.expiresAt,
        completed_at: attempt.completedAt,
        failed_at: attempt.failedAt,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create lab attempt in Supabase: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      labId: data.lab_id,
      seed: data.seed,
      mode: data.mode,
      objectivesSolved: data.objectives_solved ?? [],
      hintsUsed: data.hints_used,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      completedAt: data.completed_at,
      failedAt: data.failed_at,
    };
  }

  async findOrCreateAttempt(
    userId: string,
    labId: string,
    mode: AttemptMode,
    make: () => Omit<LabAttempt, "id">,
  ): Promise<LabAttempt> {
    const existing = await this.findLatestAttempt(userId, labId, mode);
    if (existing) return existing;
    return this.createAttempt(make());
  }

  async addSolvedObjective(id: string, objectiveId: string): Promise<LabAttempt> {
    const client = await this.getClient();
    const current = await this.getAttempt(id);
    if (!current) throw new Error("attempt not found");

    const updatedSolved = Array.from(new Set([...current.objectivesSolved, objectiveId]));

    const { data, error } = await client
      .from("lab_attempts")
      .update({ objectives_solved: updatedSolved })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to add solved objective in Supabase: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      labId: data.lab_id,
      seed: data.seed,
      mode: data.mode,
      objectivesSolved: data.objectives_solved ?? [],
      hintsUsed: data.hints_used,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      completedAt: data.completed_at,
      failedAt: data.failed_at,
    };
  }

  async updateAttempt(
    id: string,
    patch: Partial<Pick<LabAttempt, "completedAt" | "failedAt" | "hintsUsed">>,
  ): Promise<LabAttempt> {
    const client = await this.getClient();

    const dbPatch: Database["public"]["Tables"]["lab_attempts"]["Update"] = {};
    if (patch.completedAt !== undefined) dbPatch.completed_at = patch.completedAt;
    if (patch.failedAt !== undefined) dbPatch.failed_at = patch.failedAt;
    if (patch.hintsUsed !== undefined) dbPatch.hints_used = patch.hintsUsed;

    const { data, error } = await client
      .from("lab_attempts")
      .update(dbPatch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update lab attempt in Supabase: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      labId: data.lab_id,
      seed: data.seed,
      mode: data.mode,
      objectivesSolved: data.objectives_solved ?? [],
      hintsUsed: data.hints_used,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      completedAt: data.completed_at,
      failedAt: data.failed_at,
    };
  }

  // ---------------------------------------------------------------------------
  // XP Events
  // ---------------------------------------------------------------------------
  async awardXp(userId: string, source: string, amount: number): Promise<boolean> {
    const client = await this.getClient();
    const { error } = await client
      .from("xp_events")
      .insert({
        id: randomUUID(),
        user_id: userId,
        source,
        amount,
        created_at: new Date().toISOString(),
      });

    // If duplicate source (unique constraint violation), payout already occurred
    if (error) {
      if (error.code === "23505" || error.message.includes("unique")) {
        return false;
      }
      throw new Error(`Failed to award XP in Supabase: ${error.message}`);
    }

    return true;
  }

  async getXpTotal(userId: string): Promise<number> {
    const events = await this.listXpEvents(userId);
    return events.reduce((sum, e) => sum + e.amount, 0);
  }

  async listXpEvents(userId: string): Promise<XpEvent[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("xp_events")
      .select("user_id, source, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    return data.map((d) => ({
      userId: d.user_id,
      source: d.source,
      amount: d.amount,
      createdAt: d.created_at,
    }));
  }

  async listAttempts(userId: string): Promise<LabAttempt[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("lab_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: true });

    if (error || !data) return [];

    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      labId: d.lab_id,
      seed: d.seed,
      mode: d.mode,
      objectivesSolved: d.objectives_solved ?? [],
      hintsUsed: d.hints_used,
      startedAt: d.started_at,
      expiresAt: d.expires_at,
      completedAt: d.completed_at,
      failedAt: d.failed_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // Rank Challenges
  // ---------------------------------------------------------------------------
  private async listChallenges(userId: string, rank: number): Promise<RankChallenge[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("rank_challenges")
      .select("*")
      .eq("user_id", userId)
      .eq("rank", rank);

    if (error || !data) return [];

    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      rank: d.rank,
      labAttemptId: d.lab_attempt_id,
      status: d.status,
      finishedAt: d.finished_at,
    }));
  }

  async getActiveChallenge(userId: string, rank: number): Promise<RankChallenge | null> {
    const challenges = await this.listChallenges(userId, rank);
    return challenges.find((c) => c.status === "active") ?? null;
  }

  async getLastFailedChallenge(userId: string, rank: number): Promise<RankChallenge | null> {
    const challenges = await this.listChallenges(userId, rank);
    const failed = challenges
      .filter((c) => c.status === "failed" && c.finishedAt)
      .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1));
    return failed[0] ?? null;
  }

  async hasPassedChallenge(userId: string, rank: number): Promise<boolean> {
    const challenges = await this.listChallenges(userId, rank);
    return challenges.some((c) => c.status === "passed");
  }

  async createChallenge(challenge: Omit<RankChallenge, "id">): Promise<RankChallenge> {
    const client = await this.getClient();
    const id = randomUUID();

    const { data, error } = await client
      .from("rank_challenges")
      .insert({
        id,
        user_id: challenge.userId,
        rank: challenge.rank,
        lab_attempt_id: challenge.labAttemptId,
        status: challenge.status,
        finished_at: challenge.finishedAt,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create rank challenge in Supabase: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      rank: data.rank,
      labAttemptId: data.lab_attempt_id,
      status: data.status,
      finishedAt: data.finished_at,
    };
  }

  async startChallengeAtomic(input: {
    userId: string;
    rank: number;
    attempt: Omit<LabAttempt, "id">;
    cooldownMinutes: number;
    now: Date;
  }): Promise<LabAttempt> {
    const { userId, rank, cooldownMinutes, now } = input;
    const client = await this.getClient();

    const challenges = await this.listChallenges(userId, rank);
    if (challenges.some((c) => c.status === "passed")) {
      throw new Error("challenge is passed");
    }

    for (const c of challenges.filter((c) => c.status === "active")) {
      const attempt = await this.getAttempt(c.labAttemptId);
      if (attempt?.expiresAt && now > new Date(attempt.expiresAt)) {
        await this.updateAttempt(attempt.id, { failedAt: attempt.expiresAt });
        await this.updateChallenge(c.id, { status: "failed", finishedAt: attempt.expiresAt });
      } else {
        throw new Error("challenge is active");
      }
    }

    const lastFailed = challenges
      .filter((c) => c.status === "failed" && c.finishedAt)
      .map((c) => new Date(c.finishedAt!).getTime())
      .sort((a, b) => b - a)[0];

    if (lastFailed !== undefined && now.getTime() < lastFailed + cooldownMinutes * 60_000) {
      throw new Error("challenge is cooldown");
    }

    const createdAttempt = await this.createAttempt(input.attempt);
    await client.from("rank_challenges").insert({
      id: randomUUID(),
      user_id: userId,
      rank,
      lab_attempt_id: createdAttempt.id,
      status: "active",
      finished_at: null,
    });

    return createdAttempt;
  }

  async updateChallenge(
    id: string,
    patch: Partial<Pick<RankChallenge, "status" | "finishedAt">>,
  ): Promise<RankChallenge> {
    const client = await this.getClient();
    const dbPatch: Database["public"]["Tables"]["rank_challenges"]["Update"] = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.finishedAt !== undefined) dbPatch.finished_at = patch.finishedAt;

    const { data, error } = await client
      .from("rank_challenges")
      .update(dbPatch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update rank challenge in Supabase: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      rank: data.rank,
      labAttemptId: data.lab_attempt_id,
      status: data.status,
      finishedAt: data.finished_at,
    };
  }

  async listReviewItems(userId: string): Promise<ReviewItemRecord[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId);
    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      cardId: d.card_id,
      lessonId: d.lesson_id,
      easeFactor: Number(d.ease_factor),
      intervalDays: Number(d.interval_days),
      repetitions: Number(d.repetitions),
      lapses: Number(d.lapses),
      dueAt: d.due_at,
      lastReviewedAt: d.last_reviewed_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async saveReviewItem(item: Omit<ReviewItemRecord, "id"> & { id?: string }): Promise<ReviewItemRecord> {
    const client = await this.getClient();
    const record = {
      ...(item.id ? { id: item.id } : {}),
      user_id: item.userId,
      card_id: item.cardId,
      lesson_id: item.lessonId,
      ease_factor: item.easeFactor,
      interval_days: item.intervalDays,
      repetitions: item.repetitions,
      lapses: item.lapses,
      due_at: item.dueAt,
      last_reviewed_at: item.lastReviewedAt,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client
      .from("review_items")
      .upsert(record, { onConflict: "user_id,card_id" })
      .select("*")
      .single();
    if (error || !data) {
      return { ...item, id: item.id ?? randomUUID() } as ReviewItemRecord;
    }
    return {
      id: data.id,
      userId: data.user_id,
      cardId: data.card_id,
      lessonId: data.lesson_id,
      easeFactor: Number(data.ease_factor),
      intervalDays: Number(data.interval_days),
      repetitions: Number(data.repetitions),
      lapses: Number(data.lapses),
      dueAt: data.due_at,
      lastReviewedAt: data.last_reviewed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async logReviewEvent(event: Omit<ReviewEventRecord, "id">): Promise<ReviewEventRecord> {
    const client = await this.getClient();
    const id = randomUUID();
    await client.from("review_events").insert({
      id,
      user_id: event.userId,
      card_id: event.cardId,
      grade: event.grade,
      reviewed_at: event.reviewedAt,
    });
    return { ...event, id };
  }

  async logLearningEvent(event: Omit<LearningEventRecord, "id">): Promise<LearningEventRecord> {
    const client = await this.getClient();
    const id = randomUUID();
    await client.from("learning_events").insert({
      id,
      user_id: event.userId,
      event_type: event.eventType,
      metadata: event.metadata as Database["public"]["Tables"]["learning_events"]["Insert"]["metadata"],
      created_at: event.createdAt,
    });
    return { ...event, id };
  }

  async saveExamReport(report: Omit<ExamReportRecord, "id">): Promise<ExamReportRecord> {
    const client = await this.getClient();
    const id = randomUUID();
    await client.from("exam_reports").insert({
      id,
      user_id: report.userId,
      exam_type: report.examType,
      score: report.score,
      max_score: report.maxScore,
      passed: report.passed,
      notes: report.notes ?? null,
      reported_at: report.reportedAt,
    });
    return { ...report, id };
  }

  async listExamReports(userId: string): Promise<ExamReportRecord[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("exam_reports")
      .select("*")
      .eq("user_id", userId);
    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      examType: d.exam_type,
      score: d.score,
      maxScore: d.max_score,
      passed: d.passed,
      notes: d.notes,
      reportedAt: d.reported_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // SOC Workspace
  // ---------------------------------------------------------------------------
  async getSocAttempt(id: string): Promise<SocAttemptRecord | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("soc_attempts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      scenarioId: data.scenario_id,
      seed: data.seed,
      status: data.status,
      scoreSummary: data.score_summary as SocEvaluationResult | null,
      startedAt: data.started_at,
      submittedAt: data.submitted_at,
      updatedAt: data.updated_at,
    };
  }

  async findActiveSocAttempt(userId: string, scenarioId: string): Promise<SocAttemptRecord | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("soc_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("scenario_id", scenarioId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      scenarioId: data.scenario_id,
      seed: data.seed,
      status: data.status,
      scoreSummary: data.score_summary as SocEvaluationResult | null,
      startedAt: data.started_at,
      submittedAt: data.submitted_at,
      updatedAt: data.updated_at,
    };
  }

  async createSocAttempt(attempt: Omit<SocAttemptRecord, "id">): Promise<SocAttemptRecord> {
    const client = await this.getClient();
    const id = randomUUID();
    const { data, error } = await client
      .from("soc_attempts")
      .insert({
        id,
        user_id: attempt.userId,
        scenario_id: attempt.scenarioId,
        seed: attempt.seed,
        status: attempt.status,
        score_summary: attempt.scoreSummary as Database["public"]["Tables"]["soc_attempts"]["Insert"]["score_summary"],
        started_at: attempt.startedAt,
        submitted_at: attempt.submittedAt,
        updated_at: attempt.updatedAt,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`Failed to create SOC attempt in Supabase: ${error?.message}`);
    }
    return {
      id: data.id,
      userId: data.user_id,
      scenarioId: data.scenario_id,
      seed: data.seed,
      status: data.status,
      scoreSummary: data.score_summary as SocEvaluationResult | null,
      startedAt: data.started_at,
      submittedAt: data.submitted_at,
      updatedAt: data.updated_at,
    };
  }

  async updateSocAttempt(
    id: string,
    patch: Partial<Pick<SocAttemptRecord, "status" | "scoreSummary" | "submittedAt">>,
  ): Promise<SocAttemptRecord> {
    const client = await this.getClient();
    const dbPatch: Database["public"]["Tables"]["soc_attempts"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.scoreSummary !== undefined) {
      dbPatch.score_summary = patch.scoreSummary as Database["public"]["Tables"]["soc_attempts"]["Update"]["score_summary"];
    }
    if (patch.submittedAt !== undefined) dbPatch.submitted_at = patch.submittedAt;

    const { data, error } = await client
      .from("soc_attempts")
      .update(dbPatch)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`Failed to update SOC attempt in Supabase: ${error?.message}`);
    }
    return {
      id: data.id,
      userId: data.user_id,
      scenarioId: data.scenario_id,
      seed: data.seed,
      status: data.status,
      scoreSummary: data.score_summary as SocEvaluationResult | null,
      startedAt: data.started_at,
      submittedAt: data.submitted_at,
      updatedAt: data.updated_at,
    };
  }

  async saveSocDecision(decision: Omit<SocDecisionRecord, "id">): Promise<SocDecisionRecord> {
    const client = await this.getClient();
    const id = randomUUID();
    const { data, error } = await client
      .from("soc_decisions")
      .insert({
        id,
        attempt_id: decision.attemptId,
        alert_id: decision.alertId,
        disposition: decision.disposition,
        severity: decision.severity,
        escalate: decision.escalate,
        target_tier: decision.targetTier,
        rationale: decision.rationale,
        evidence_refs: decision.evidenceRefs,
        created_at: decision.createdAt,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`Failed to save SOC decision in Supabase: ${error?.message}`);
    }
    return {
      id: data.id,
      attemptId: data.attempt_id,
      alertId: data.alert_id,
      disposition: data.disposition as SocDecisionRecord["disposition"],
      severity: data.severity as SocDecisionRecord["severity"],
      escalate: data.escalate,
      targetTier: data.target_tier as SocDecisionRecord["targetTier"],
      rationale: data.rationale,
      evidenceRefs: data.evidence_refs,
      createdAt: data.created_at,
    };
  }

  async listSocDecisions(attemptId: string): Promise<SocDecisionRecord[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("soc_decisions")
      .select("*")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      attemptId: d.attempt_id,
      alertId: d.alert_id,
      disposition: d.disposition as SocDecisionRecord["disposition"],
      severity: d.severity as SocDecisionRecord["severity"],
      escalate: d.escalate,
      targetTier: d.target_tier as SocDecisionRecord["targetTier"],
      rationale: d.rationale,
      evidenceRefs: d.evidence_refs,
      createdAt: d.created_at,
    }));
  }

  async saveSocCase(
    socCase: Omit<SocCaseRecord, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<SocCaseRecord> {
    const client = await this.getClient();
    const id = socCase.id ?? randomUUID();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("soc_cases")
      .upsert(
        {
          id,
          attempt_id: socCase.attemptId,
          title: socCase.title,
          severity: socCase.severity,
          status: socCase.status,
          notes: socCase.notes,
          updated_at: now,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`Failed to save SOC case in Supabase: ${error?.message}`);
    }

    // Sync alerts
    if (socCase.alertIds) {
      // Remove alerts not in list
      await client.from("soc_case_alerts").delete().eq("case_id", id);
      if (socCase.alertIds.length > 0) {
        await client.from("soc_case_alerts").insert(
          socCase.alertIds.map((aid) => ({
            id: randomUUID(),
            case_id: id,
            alert_id: aid,
          })),
        );
      }
    }

    return {
      id: data.id,
      attemptId: data.attempt_id,
      title: data.title,
      severity: data.severity as SocCaseRecord["severity"],
      status: data.status as SocCaseRecord["status"],
      notes: data.notes,
      alertIds: socCase.alertIds ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteSocCase(id: string): Promise<void> {
    const client = await this.getClient();
    await client.from("soc_cases").delete().eq("id", id);
  }

  async listSocCases(attemptId: string): Promise<SocCaseRecord[]> {
    const client = await this.getClient();
    const { data: casesData, error: casesError } = await client
      .from("soc_cases")
      .select("*")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true });
    if (casesError || !casesData) return [];

    const caseIds = casesData.map((c) => c.id);
    let alertsMap = new Map<string, string[]>();
    if (caseIds.length > 0) {
      const { data: alertsData } = await client
        .from("soc_case_alerts")
        .select("*")
        .in("case_id", caseIds);
      if (alertsData) {
        for (const a of alertsData) {
          const arr = alertsMap.get(a.case_id) ?? [];
          arr.push(a.alert_id);
          alertsMap.set(a.case_id, arr);
        }
      }
    }

    return casesData.map((c) => ({
      id: c.id,
      attemptId: c.attempt_id,
      title: c.title,
      severity: c.severity as SocCaseRecord["severity"],
      status: c.status as SocCaseRecord["status"],
      notes: c.notes,
      alertIds: alertsMap.get(c.id) ?? [],
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  async listSocAttempts(userId: string): Promise<SocAttemptRecord[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("soc_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });
    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      scenarioId: d.scenario_id,
      seed: d.seed,
      status: d.status,
      scoreSummary: d.score_summary as SocEvaluationResult | null,
      startedAt: d.started_at,
      submittedAt: d.submitted_at,
      updatedAt: d.updated_at,
    }));
  }

  async listUsedSeeds(userId: string, familyId: string): Promise<string[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("soc_used_seeds" as any)
      .select("seed")
      .eq("user_id", userId)
      .eq("family_id", familyId);
    if (error || !data) return [];
    return (data as any[]).map((d) => d.seed);
  }

  async recordUsedSeed(userId: string, familyId: string, seed: string): Promise<void> {
    const client = await this.getClient();
    await client
      .from("soc_used_seeds" as any)
      .insert({
        id: randomUUID(),
        user_id: userId,
        family_id: familyId,
        seed,
      } as any);
  }

  async deleteUserData(userId: string): Promise<void> {
    const client = await this.getClient();
    await client.from("soc_attempts").delete().eq("user_id", userId);
    await client.from("soc_used_seeds" as any).delete().eq("user_id", userId);
    await client.from("exam_reports").delete().eq("user_id", userId);
    await client.from("review_items").delete().eq("user_id", userId);
  }
}

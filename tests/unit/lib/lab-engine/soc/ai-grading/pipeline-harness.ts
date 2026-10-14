import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { Ctx } from "@/lib/progress/service";
import { resolveScenarioForAttempt, startSocSession } from "@/lib/lab-engine/soc/engine";
import { submitSocReport } from "@/lib/lab-engine/soc/report-engine";
import { getReportTemplate } from "@/lib/lab-engine/soc/reports/templates";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";
import type { SocScenario } from "@/lib/lab-engine/soc/schema";
import type { SocAttemptRecord } from "@/lib/lab-engine/soc/types";
import { createMemoryAiGradingStore } from "@/lib/lab-engine/soc/ai-grading/store/local-store";
import { loadAiGradingConfig, type AiGradingConfig } from "@/lib/lab-engine/soc/ai-grading/config";
import type { AiPipelineDeps } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import type { AiCompletionProvider } from "@/lib/lab-engine/soc/ai-grading/provider";
import { createContentHeuristicMock } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { sampleReport } from "./helpers";

export function makeCtx(clock: { t: Date }): Ctx {
  return {
    repo: new MemoryProgressRepo(),
    now: () => clock.t,
    operators: {
      get: async () => null,
      create: async () => {
        throw new Error("not implemented");
      },
      setRank: async () => {},
      delete: async () => {},
    },
    content: {
      getLesson: async () => null,
      getLessons: async () => [],
      loadChecks: async () => {
        throw new Error("not implemented");
      },
      loadLab: async () => {
        throw new Error("not implemented");
      },
      listLabs: async () => [],
      generators: {},
    },
  };
}

export function tempGateDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "soc-ai-gates-"));
}

export interface Harness {
  ctx: Ctx;
  clock: { t: Date };
  deps: AiPipelineDeps;
  store: ReturnType<typeof createMemoryAiGradingStore>;
  submit(userId: string, report?: SocReportData, scenarioId?: string): Promise<{ submissionId: string; attemptId: string; deterministicTotal: number }>;
}

export function harness(opts: {
  env?: Record<string, string | undefined>;
  provider?: AiCompletionProvider;
  config?: Partial<AiGradingConfig>;
  scenarioOverride?: (s: SocScenario, attempt: SocAttemptRecord) => SocScenario;
  gateDir?: string;
} = {}): Harness {
  const clock = { t: new Date("2026-10-14T10:00:00Z") };
  const ctx = makeCtx(clock);
  const store = createMemoryAiGradingStore(() => clock.t);
  const base = loadAiGradingConfig();
  const config = { ...base, ...opts.config } as AiGradingConfig;
  const deps: AiPipelineDeps = {
    store,
    getSubmission: (id) => ctx.repo.getSocReportSubmission(id),
    getAttempt: (id) => ctx.repo.getSocAttempt(id),
    resolveScenario: async (attempt) => {
      const s = await resolveScenarioForAttempt(attempt);
      return opts.scenarioOverride ? opts.scenarioOverride(structuredClone(s), attempt) : s;
    },
    loadTemplate: (id) => getReportTemplate(id),
    learnerHandles: async () => ["op_kavya"],
    provider: opts.provider ?? createContentHeuristicMock(),
    now: () => clock.t,
    env: { NODE_ENV: "test", SOC_AI_GRADING_MODE: "preview", ...opts.env } as NodeJS.ProcessEnv,
    config,
    gateDir: opts.gateDir ?? tempGateDir(),
  };
  return {
    ctx,
    clock,
    deps,
    store,
    async submit(userId, report = sampleReport(), scenarioId = "soc-l1-noisy-shift") {
      const session = await startSocSession(ctx, userId, scenarioId);
      const res = await submitSocReport(ctx, userId, session.attempt.id, report);
      return { submissionId: res.submissionId, attemptId: session.attempt.id, deterministicTotal: res.gradingResult.totalScore };
    },
  };
}

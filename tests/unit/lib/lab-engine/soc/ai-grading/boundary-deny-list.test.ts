import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { parse as parseYaml } from "yaml";
import { enqueueAiGrading, processAiGradingJobs } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import { createContentHeuristicMock } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { buildCriterionPrompt } from "@/lib/lab-engine/soc/ai-grading/prompt";
import { loadAiGradingConfig, loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import { prepareSubmission } from "@/lib/lab-engine/soc/ai-grading/session";
import { toClientView, type SocScenario } from "@/lib/lab-engine/soc/schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { generateFixtureReport } from "@/lib/lab-engine/soc/reports/fixtures";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { harness } from "./pipeline-harness";
import { loadTemplate, sampleReport } from "./helpers";

/** Plant a unique sentinel in every server-only field of a scenario. */
function plantSentinels(s: SocScenario): SocScenario {
  s.seed = "SENTINEL_SEED_7f3a";
  s.variantOf = "SENTINEL_FAMILY_ID_19c2";
  s.generatorConfig = { secret: "SENTINEL_GENCONFIG_55aa" };
  s.groundTruth.overallDebrief = "SENTINEL_DEBRIEF_0b1c";
  s.enrichmentSources = [{ id: "e1", type: "whois", indicator: "SENTINEL_ENRICH_IND_6d6d", data: { note: "SENTINEL_ENRICH_DATA_77ee" } }];
  for (const a of s.alerts) {
    (a as unknown as { groundTruth: Record<string, unknown> }).groundTruth = {
      ...(a as unknown as { groundTruth: Record<string, unknown> }).groundTruth,
      rationale: "SENTINEL_ALERT_TRUTH_3c3c",
    };
  }
  for (const inc of s.groundTruth.incidents) {
    inc.description = "SENTINEL_INCIDENT_DESC_a1a1";
    inc.rootCause = "SENTINEL_ROOT_CAUSE_b2b2";
    inc.title = "SENTINEL_INCIDENT_TITLE_c3c3";
    if (inc.reportGroundTruth) {
      const m = inc.reportGroundTruth.modelReport;
      m.executiveSummary = "SENTINEL_MODEL_SUMMARY_d4d4";
      m.attackNarrative = "SENTINEL_MODEL_NARRATIVE_e5e5";
      m.escalation.handoffSummary = "SENTINEL_MODEL_HANDOFF_f6f6";
      inc.reportGroundTruth.iocs.push({ type: "domain", value: "sentinel-truth-ioc.invalid", role: "c2", isTruePositive: true, description: "SENTINEL_IOC_DESC_0707" });
      inc.reportGroundTruth.milestones.forEach((ms) => (ms.description = "SENTINEL_MILESTONE_0808"));
    }
  }
  return s;
}

const SENTINEL = /SENTINEL_|sentinel-truth-ioc/;
const FORBIDDEN_KEYS = /"?(groundTruth|reportGroundTruth|truePositiveAlertIds|isTruePositive|modelReport|modelReportReveal|overallDebrief|generatorConfig|scenarioHash|totalScore|criterionResults|versionLabel)"?/;

describe("information boundary: what a model may see", () => {
  it("no prompt sent by the pipeline contains ground truth, seeds, family internals or deterministic scores", { timeout: 60_000 }, async () => {
    const provider = createContentHeuristicMock();
    let attemptSeed = "";
    const h = harness({
      provider,
      scenarioOverride: (s, attempt) => {
        attemptSeed = attempt.seed;
        return plantSentinels(s);
      },
    });
    for (const scenarioId of ["soc-l1-noisy-shift", "soc-f-phishing-cred-01", "shift-quiet-day"]) {
      const { submissionId } = await h.submit(`u-${scenarioId}`, sampleReport(), scenarioId);
      await enqueueAiGrading(h.deps, submissionId);
    }
    await processAiGradingJobs(h.deps, { limit: 100 });

    expect(provider.calls.length).toBeGreaterThanOrEqual(30);
    for (const call of provider.calls) {
      const sent = `${call.systemPrompt}\n${call.userMessage}`;
      expect(sent).not.toMatch(SENTINEL);
      expect(sent).not.toMatch(FORBIDDEN_KEYS);
      expect(sent).not.toContain(attemptSeed);
      expect(sent).not.toMatch(/soc-f-[a-z-]+-\d\d/); // family ids
      expect(sent).not.toMatch(/op_kavya/); // the learner's handle is scrubbed
    }
  });

  it("every prompt the builder can construct (all criteria x many generated reports) stays inside the boundary", { timeout: 60_000 }, () => {
    const config = loadAiGradingConfig();
    const rubric = loadAiRubric();
    const template = loadTemplate();
    const dir = path.resolve("content/soc/families");
    const families = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => socFamilySchema.parse(parseYaml(fs.readFileSync(path.join(dir, f), "utf8"))) as SocFamily);
    let built = 0;
    for (const family of families) {
      for (let seed = 1; seed <= 3; seed++) {
        const variant = generateSocVariant(family, `deny-${seed}`, "intermediate").scenario;
        const truth = variant.groundTruth.incidents[0]?.reportGroundTruth;
        if (!truth) continue;
        // Learner report is produced BEFORE planting, so honest copies of truth are the learner's own text.
        const report = generateFixtureReport(truth, "good", { seed });
        const planted = plantSentinels(structuredClone(variant));
        const client = toClientView(planted);
        const prepared = prepareSubmission(report, { title: client.title, briefing: client.briefing }, template);
        for (const c of rubric.criteria) {
          const p = buildCriterionPrompt(c, prepared.input, { aiRubricVersion: rubric.version, promptVersion: config.promptVersion });
          const sent = `${p.system}\n${p.user}`;
          expect(sent).not.toMatch(SENTINEL);
          expect(sent).not.toMatch(FORBIDDEN_KEYS);
          expect(sent).not.toContain(family.metadata.id);
          expect(sent).toContain(p.canary); // canary is in the system prompt...
          expect(p.user).not.toContain(p.canary); // ...never in the user turn
          built++;
        }
      }
    }
    expect(built).toBeGreaterThanOrEqual(100);
  });

  it("the prompt templates themselves have no placeholder for forbidden data", () => {
    for (const f of fs.readdirSync(path.resolve("content/soc/ai-grading/prompts"))) {
      const t = fs.readFileSync(path.resolve("content/soc/ai-grading/prompts", f), "utf8");
      const placeholders = [...t.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
      for (const ph of placeholders) {
        expect(["FENCE_OPEN", "FENCE_CLOSE", "CANARY", "CRITERION_TITLE", "CRITERION_QUESTION", "BANDS", "SCENARIO_FACTS", "TEMPLATE_GUIDANCE", "SECTION_LIST", "REPORT_TEXT"]).toContain(ph);
      }
    }
  });
});

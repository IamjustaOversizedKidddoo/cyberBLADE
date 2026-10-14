/**
 * Calibration harness CLI. Data lives under .data/soc-ai-calibration/<set>/ (git-ignored).
 *
 *   demo                              Build and evaluate the SYNTHETIC demo set (mock model). Never passes.
 *   export --set <id>                 Export anonymized packets from CONSENTING learners only.
 *   purge-revoked --set <id>          Drop packets whose learner has since revoked consent.
 *   import-human --set <id> --file <csv>   Import human bands (packetId,graderId,band; pseudonyms only).
 *   grade --set <id> --provider mock|real [--i-understand-this-calls-a-real-provider]
 *   gate --set <id> --provider mock|real [--write] [--i-understand-this-calls-a-real-provider]
 *
 * `gate --write` writes the gate file with an EMPTY sign-off. Live mode stays refused until the
 * owner fills signOff.signedOffBy / signedOffAt by hand after reviewing the numbers.
 */
import fs from "node:fs";
import path from "node:path";
import { getCtx } from "../lib/progress/context";
import { getReportTemplate } from "../lib/lab-engine/soc/reports/templates";
import { createEmptyReportData } from "../lib/lab-engine/soc/reports/defaults";
import { toClientView } from "../lib/lab-engine/soc/schema";
import { resolveScenarioForAttempt } from "../lib/lab-engine/soc/engine";
import { loadAiGradingConfig, loadAiRubric } from "../lib/lab-engine/soc/ai-grading/config";
import { currentVersions, GATE_DIR, gateFileName } from "../lib/lab-engine/soc/ai-grading/gate";
import { configuredModelId } from "../lib/lab-engine/soc/ai-grading/pipeline";
import { getAiGradingProvider, type AiCompletionProvider } from "../lib/lab-engine/soc/ai-grading/provider";
import { getAiGradingStore } from "../lib/lab-engine/soc/ai-grading/runtime";
import { prepareSubmission } from "../lib/lab-engine/soc/ai-grading/session";
import { createContentHeuristicMock } from "../lib/lab-engine/soc/ai-grading/mock-providers";
import {
  CALIBRATION_CONSENT_VERSION,
  hashPackets,
  manifestSchema,
  modelScoreSchema,
  newExportSalt,
  packetSchema,
  packetsForSubmission,
  parseHumanScoresCsv,
  type CalibrationManifest,
  type CalibrationPacket,
} from "../lib/lab-engine/soc/ai-grading/calibration/packets";
import { evaluateGate, gradePackets, toGateFile } from "../lib/lab-engine/soc/ai-grading/calibration/gate-eval";
import { runFairnessSuite } from "../lib/lab-engine/soc/ai-grading/calibration/fairness";
import { runInjectionSuite } from "../lib/lab-engine/soc/ai-grading/calibration/injection-suite";
import { injectionBaseReport } from "../lib/lab-engine/soc/ai-grading/calibration/injection-corpus";
import { simulatedHumanScores, SYNTHETIC_FACTS, syntheticManifest, syntheticPackets, syntheticReports } from "../lib/lab-engine/soc/ai-grading/calibration/synthetic";
import { realProviderRefusal } from "../lib/lab-engine/soc/ai-grading/calibration/real-provider-guard";
import { z } from "zod";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE = path.resolve(process.env.NEON_DATA_DIR ?? ".data", "soc-ai-calibration");
const setDir = (id: string) => {
  if (!/^[a-z0-9-]{3,64}$/.test(id)) throw new Error("set id must be 3-64 chars of a-z, 0-9, -");
  return path.join(BASE, id);
};
const readJson = <T,>(file: string, schema: z.ZodType<T>): T => schema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const config = loadAiGradingConfig();
const rubric = loadAiRubric();
const v = currentVersions();
const template = await getReportTemplate("incident-report-l1");

function providerFor(kind: string | undefined): { provider: AiCompletionProvider; modelId: string } {
  if (kind === "real") {
    const refusal = realProviderRefusal(argv, process.env);
    if (refusal) throw new Error(refusal);
    return { provider: getAiGradingProvider({ ...process.env, SOC_AI_PROVIDER: "" }), modelId: configuredModelId({ ...process.env, SOC_AI_PROVIDER: "" }) };
  }
  if (kind !== "mock") throw new Error("--provider must be mock or real");
  return { provider: createContentHeuristicMock(), modelId: "mock:content-heuristic" };
}

function summary(ev: ReturnType<typeof evaluateGate>) {
  const o = ev.overall;
  const f = (x: number | null | undefined, d = 3) => (x === null || x === undefined ? "n/a" : x.toFixed(d));
  console.log(`reports=${ev.reports} items=${o.items}`);
  console.log(`weighted kappa=${f(o.weightedKappa.estimate)} (95% CI ${f(o.weightedKappa.low)}..${f(o.weightedKappa.high)})  within-one=${f(o.withinOneBand)}  MAE=${f(o.mae)}  bias=${f(o.signedBias)}`);
  console.log(`human-human kappa=${f(o.humanHumanKappa)}  alpha(humans+model)=${f(o.alphaHumansAndModel)}  ICC(2,1)=${f(o.icc21)}  flip rate=${f(o.flipRate)}`);
  for (const [c, m] of Object.entries(ev.perCriterion)) console.log(`  ${c.padEnd(28)} kappa=${f(m.weightedKappa.estimate)} within-one=${f(m.withinOneBand)} n=${m.items}`);
  console.log(ev.passed ? "GATE: PASS (sign-off still required)" : `GATE: FAIL\n - ${ev.failures.join("\n - ")}`);
}

/** Fairness and injection suites against the MODEL UNDER TEST (the obedient adversary lives in unit tests). */
async function suites(provider: AiCompletionProvider) {
  const fairness = await runFairnessSuite({ reports: syntheticReports(8, "fairness"), rubric, config, template, facts: SYNTHETIC_FACTS, provider: () => provider });
  const injection = await runInjectionSuite({
    baseReport: injectionBaseReport(createEmptyReportData),
    rubric,
    config,
    template,
    facts: SYNTHETIC_FACTS,
    baselineProvider: provider,
    attackProvider: () => provider,
    maxCountedElevation: config.gate.injectionMaxCountedElevation,
    maxSusceptibilityRate: config.gate.injectionMaxSusceptibilityRate,
  });
  return { fairness, injection };
}

async function main() {
  switch (cmd) {
    case "demo": {
      const packets = syntheticPackets(syntheticReports(20, "demo"), rubric, template, "demo");
      const human = simulatedHumanScores(packets);
      const { provider, modelId } = providerFor("mock");
      const model = await gradePackets({ packets, rubric, config, template, provider });
      const manifest = syntheticManifest(packets, { id: "synthetic-demo", ...v, modelId, createdAt: new Date().toISOString() });
      const { fairness, injection } = await suites(provider);
      const ev = evaluateGate({ manifest, packets, human, model, fairness, injection, config, current: v, modelId });
      const dir = setDir("synthetic-demo");
      writeJson(path.join(dir, "manifest.json"), manifest);
      writeJson(path.join(dir, "packets.json"), packets);
      writeJson(path.join(dir, "model.json"), model);
      writeJson(path.join(dir, "evaluation.json"), ev);
      console.log("SYNTHETIC DEMO: proves the tooling only. Says nothing about real AI grading quality.");
      summary(ev);
      return;
    }
    case "export": {
      const id = opt("set");
      if (!id) throw new Error("--set <id> required");
      const ctx = getCtx();
      const store = getAiGradingStore();
      const users = await store.listConsentingUserIds(CALIBRATION_CONSENT_VERSION);
      const salt = newExportSalt();
      const packets: CalibrationPacket[] = [];
      const privateMap: Record<string, { userId: string; submissionId: string }> = {};
      for (const userId of users) {
        const op = await ctx.operators.get(userId);
        for (const attempt of await ctx.repo.listSocAttempts(userId)) {
          for (const sub of (await ctx.repo.listSocReportSubmissions(attempt.id)).filter((s) => s.status === "submitted")) {
            const client = toClientView(await resolveScenarioForAttempt(attempt));
            const prepared = prepareSubmission(sub.reportData, { title: client.title, briefing: client.briefing }, template, op ? [op.handle] : []);
            for (const p of packetsForSubmission(prepared.input, rubric, { sourceId: sub.id, salt, synthetic: false })) {
              packets.push(p);
              privateMap[p.packetId] = { userId, submissionId: sub.id };
            }
          }
        }
      }
      const manifest: CalibrationManifest = {
        id,
        synthetic: false,
        ...v,
        modelId: configuredModelId(),
        createdAt: new Date().toISOString(),
        packetCount: packets.length,
        reportCount: new Set(packets.map((p) => p.reportRef)).size,
        hash: hashPackets(packets),
        consentVersion: CALIBRATION_CONSENT_VERSION,
      };
      const dir = setDir(id);
      writeJson(path.join(dir, "manifest.json"), manifest);
      writeJson(path.join(dir, "packets.json"), packets);
      // Kept locally (never shared with graders) so revoked consent can be honoured later.
      writeJson(path.join(dir, "private-map.json"), privateMap);
      console.log(`Exported ${packets.length} packets from ${manifest.reportCount} reports by ${users.length} consenting learners (consent ${CALIBRATION_CONSENT_VERSION}). Share packets.json only.`);
      return;
    }
    case "purge-revoked": {
      const dir = setDir(opt("set") ?? "");
      const store = getAiGradingStore();
      const map = JSON.parse(fs.readFileSync(path.join(dir, "private-map.json"), "utf8")) as Record<string, { userId: string }>;
      const allowed = new Set(await store.listConsentingUserIds(CALIBRATION_CONSENT_VERSION));
      const packets = readJson(path.join(dir, "packets.json"), z.array(packetSchema));
      const kept = packets.filter((p) => allowed.has(map[p.packetId]?.userId));
      writeJson(path.join(dir, "packets.json"), kept);
      console.log(`Removed ${packets.length - kept.length} packets from learners who revoked consent. Ask graders to delete earlier copies.`);
      return;
    }
    case "import-human": {
      const dir = setDir(opt("set") ?? "");
      const file = opt("file");
      if (!file) throw new Error("--file <csv> required");
      const scores = parseHumanScoresCsv(fs.readFileSync(file, "utf8"));
      const known = new Set(readJson(path.join(dir, "packets.json"), z.array(packetSchema)).map((p) => p.packetId));
      const unknown = scores.filter((s) => !known.has(s.packetId));
      if (unknown.length) throw new Error(`${unknown.length} rows reference packets not in this set`);
      writeJson(path.join(dir, "human.json"), scores);
      console.log(`Imported ${scores.length} human bands from ${new Set(scores.map((s) => s.graderId)).size} graders.`);
      return;
    }
    case "grade": {
      const dir = setDir(opt("set") ?? "");
      const { provider, modelId } = providerFor(opt("provider"));
      const packets = readJson(path.join(dir, "packets.json"), z.array(packetSchema));
      const model = await gradePackets({ packets, rubric, config, template, provider });
      writeJson(path.join(dir, "model.json"), model);
      const manifest = readJson(path.join(dir, "manifest.json"), manifestSchema);
      writeJson(path.join(dir, "manifest.json"), { ...manifest, modelId });
      console.log(`Graded ${packets.length} packets twice with ${modelId}.`);
      return;
    }
    case "gate": {
      const dir = setDir(opt("set") ?? "");
      const kind = opt("provider");
      const { provider, modelId } = providerFor(kind);
      const manifest = readJson(path.join(dir, "manifest.json"), manifestSchema);
      const packets = readJson(path.join(dir, "packets.json"), z.array(packetSchema));
      const human = fs.existsSync(path.join(dir, "human.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "human.json"), "utf8")) : [];
      const model = readJson(path.join(dir, "model.json"), z.array(modelScoreSchema));
      const { fairness, injection } = await suites(provider);
      const ev = evaluateGate({ manifest, packets, human, model, fairness, injection, config, current: v, modelId });
      writeJson(path.join(dir, "evaluation.json"), ev);
      summary(ev);
      if (argv.includes("--write")) {
        if (manifest.synthetic) throw new Error("refusing to write a gate file for a synthetic set");
        const gate = toGateFile(ev, { manifest, current: v, modelId, thresholdsVersion: config.gate.thresholdsVersion, computedAt: new Date().toISOString() });
        const file = path.resolve(GATE_DIR, gateFileName(v, modelId));
        writeJson(file, gate);
        console.log(`Wrote ${path.relative(process.cwd(), file)} with an EMPTY sign-off. Review it, then sign by hand to allow live mode.`);
      }
      return;
    }
    default:
      console.log("usage: soc:ai:calibration <demo|export|purge-revoked|import-human|grade|gate> [options]");
      process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

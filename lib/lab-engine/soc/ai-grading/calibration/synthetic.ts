/**
 * SYNTHETIC calibration material. It exercises the tooling end to end and is marked
 * synthetic everywhere, so the gate always rejects it. It says nothing about real AI quality.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { generateSocVariant } from "../../generator";
import { socFamilySchema, type SocFamily } from "../../family-schema";
import { generateFixtureReport, type ReportQualityLevel } from "../../reports/fixtures";
import type { ReportTemplate, SocReportData } from "../../reports/types";
import { createRng } from "@/lib/generators/rng";
import { contentBand } from "../mock-providers";
import { prepareSubmission } from "../session";
import type { AiRubric } from "../types";
import { CALIBRATION_CONSENT_VERSION, hashPackets, packetsForSubmission, type CalibrationManifest, type CalibrationPacket, type HumanScore } from "./packets";

const FACTS = { title: "Synthetic calibration shift", briefing: "Synthetic briefing. Fictional organisation and reserved-domain data only." };

/** Deterministic synthetic reports across families, seeds and quality tiers. */
export function syntheticReports(count: number, seedPrefix = "synthetic"): SocReportData[] {
  const dir = path.resolve("content/soc/families");
  const families = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => socFamilySchema.parse(parseYaml(fs.readFileSync(path.join(dir, f), "utf8"))) as SocFamily);
  const tiers: ReportQualityLevel[] = ["excellent", "good", "mediocre", "poor"];
  const out: SocReportData[] = [];
  for (let i = 0; out.length < count && i < count * 4; i++) {
    const family = families[i % families.length];
    const truth = generateSocVariant(family, `${seedPrefix}-${i}`, "intermediate").scenario.groundTruth.incidents[0]?.reportGroundTruth;
    if (truth) out.push(generateFixtureReport(truth, tiers[i % tiers.length], { seed: i }));
  }
  return out;
}

export function syntheticPackets(reports: SocReportData[], rubric: AiRubric, template: Pick<ReportTemplate, "sections">, salt: string): CalibrationPacket[] {
  return reports.flatMap((r, i) => packetsForSubmission(prepareSubmission(r, FACTS, template).input, rubric, { sourceId: `synthetic-${i}`, salt, synthetic: true }));
}

/** Three simulated graders: the content heuristic plus seeded disagreement. */
export function simulatedHumanScores(packets: CalibrationPacket[], seed = "demo-graders"): HumanScore[] {
  const rng = createRng(seed);
  const graders = ["demo-grader-a", "demo-grader-b", "demo-grader-c"];
  return packets.flatMap((p) => {
    const truth = contentBand(p.sections.map((s) => s.text).join("\n"));
    return graders.map((graderId) => {
      const roll = rng.next();
      const noise = roll < 0.1 ? -1 : roll > 0.9 ? 1 : 0;
      return { packetId: p.packetId, graderId, band: Math.max(0, Math.min(3, truth + noise)) };
    });
  });
}

export function syntheticManifest(packets: CalibrationPacket[], args: { id: string; aiRubricVersion: string; promptVersion: string; modelId: string; createdAt: string }): CalibrationManifest {
  return {
    ...args,
    synthetic: true,
    packetCount: packets.length,
    reportCount: new Set(packets.map((p) => p.reportRef)).size,
    hash: hashPackets(packets),
    consentVersion: CALIBRATION_CONSENT_VERSION,
  };
}

export const SYNTHETIC_FACTS = FACTS;

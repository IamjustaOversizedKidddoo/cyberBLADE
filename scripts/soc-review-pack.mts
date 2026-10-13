import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "../lib/lab-engine/soc/family-schema";
import { shiftProfileSchema, type ShiftProfile } from "../lib/lab-engine/soc/shift-schema";
import { generateSocVariant } from "../lib/lab-engine/soc/generator";
import { loadFamilyCatalog, composeShiftScenario } from "../lib/lab-engine/soc/shift-composer";
import { runFamilyProof } from "../lib/lab-engine/soc/family-validator";
import { toClientView, type SocScenario } from "../lib/lab-engine/soc/schema";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const familyIdx = args.indexOf("--family");
  const shiftIdx = args.indexOf("--shift");
  const countIdx = args.indexOf("--count");

  const targetFamilyId = familyIdx !== -1 ? args[familyIdx + 1] : undefined;
  const targetShiftId = shiftIdx !== -1 ? args[shiftIdx + 1] : undefined;
  const count = countIdx !== -1 && args[countIdx + 1] ? parseInt(args[countIdx + 1], 10) : 3;

  if (!targetFamilyId && !targetShiftId) {
    console.error("Usage: npm run soc:review-pack -- --family <family-id> [--count 3]");
    console.error("       npm run soc:review-pack -- --shift <shift-id> [--count 3]");
    console.error("\nAvailable families:");
    const fFiles = fs.readdirSync("content/soc/families").filter((f) => f.endsWith(".yaml"));
    for (const f of fFiles) console.log(`  - ${f.replace(".yaml", "")}`);
    console.error("\nAvailable shifts:");
    const sFiles = fs.readdirSync("content/soc/shifts").filter((f) => f.endsWith(".yaml"));
    for (const s of sFiles) console.log(`  - ${s.replace(".yaml", "")}`);
    return 1;
  }

  const catalog = loadFamilyCatalog();

  let targetId = "";
  let targetTitle = "";
  let targetLevel = "";
  let targetSkills: string[] = [];
  const sampleVariants: SocScenario[] = [];

  if (targetFamilyId) {
    targetId = targetFamilyId;
    const family = catalog.get(targetFamilyId);
    if (!family) {
      console.error(`✗ Family '${targetFamilyId}' not found in content/soc/families`);
      return 1;
    }
    targetTitle = family.metadata.title;
    targetLevel = family.metadata.level;
    targetSkills = family.metadata.skillsTested;

    for (let i = 1; i <= count; i++) {
      const seed = `review-sample-${targetFamilyId}-${i * 1337}`;
      sampleVariants.push(generateSocVariant(family, seed, "intermediate").scenario);
    }
  } else if (targetShiftId) {
    targetId = targetShiftId;
    const shiftPath = path.resolve(`content/soc/shifts/${targetShiftId}.yaml`);
    if (!fs.existsSync(shiftPath)) {
      console.error(`✗ Shift profile '${targetShiftId}' not found in content/soc/shifts`);
      return 1;
    }
    const raw = parseYaml(fs.readFileSync(shiftPath, "utf8"));
    const shiftProfile = shiftProfileSchema.parse(raw);
    targetTitle = shiftProfile.title;
    targetLevel = shiftProfile.level;
    targetSkills = shiftProfile.skillsTested;

    for (let i = 1; i <= count; i++) {
      const seed = `review-sample-${targetShiftId}-${i * 1337}`;
      sampleVariants.push(composeShiftScenario(shiftProfile, seed, catalog));
    }
  }

  // 1. Output Review Pack Header
  console.log("================================================================================");
  console.log(`PRACTITIONER REVIEW PACK: ${targetTitle}`);
  console.log(`Target ID: ${targetId} | Level: ${targetLevel} | Sample Size: ${count} Variants`);
  console.log("================================================================================\n");

  console.log("INTENDED SKILLS TESTED:");
  for (const s of targetSkills) {
    console.log(`  - ${s}`);
  }
  console.log("");

  // 2. Output Variant Client Views (Redacted from ground truth)
  for (let vIdx = 0; vIdx < sampleVariants.length; vIdx++) {
    const sc = sampleVariants[vIdx];
    const client = toClientView(sc);

    console.log("--------------------------------------------------------------------------------");
    console.log(`SAMPLE VARIANT ${vIdx + 1} OF ${count} [Seed: ${sc.seed}]`);
    console.log(`Title: ${client.title}`);
    console.log(`Alerts in Queue: ${client.alerts.length} | Raw Events: ${client.rawEvents.length}`);
    console.log("Briefing: " + client.briefing);
    console.log("--------------------------------------------------------------------------------");
    console.log("QUEUE SAMPLE (First 6 alerts):");
    const displayAlerts = client.alerts.slice(0, 6);
    for (const a of displayAlerts) {
      console.log(`  [${a.id}] ${a.timestamp} | ${a.severity.padEnd(8)} | ${a.ruleName}`);
      console.log(`        Summary: ${a.summary}`);
      console.log(`        Asset:   ${a.relatedAsset ?? "N/A"} | User: ${a.relatedUser ?? "N/A"}`);
      if (a.relatedIocs.length > 0) {
        console.log(`        IOCs:    ${a.relatedIocs.map((i) => `${i.type}:${i.value}`).join(", ")}`);
      }
      console.log("");
    }
    if (client.alerts.length > 6) {
      console.log(`  ... and ${client.alerts.length - 6} additional alerts in queue.`);
    }
    console.log("");
  }

  // 3. Output Practitioner Review Checklist
  console.log("================================================================================");
  console.log("PRACTITIONER REVIEW CHECKLIST");
  console.log("================================================================================");
  console.log("[ ] 1. Alert Wording Plausibility: Alerts read like real vendor detections, not CTF flags.");
  console.log("    Notes: _____________________________________________________________________\n");
  console.log("[ ] 2. Severity Calibration: Tool severity is imperfect (not 1:1 with ground truth).");
  console.log("    Notes: _____________________________________________________________________\n");
  console.log("[ ] 3. Noise Ratio Fairness: Informational & benign traffic provides realistic workload.");
  console.log("    Notes: _____________________________________________________________________\n");
  console.log("[ ] 4. Timeline Plausibility: Event intervals & arrival times reflect real protocols.");
  console.log("    Notes: _____________________________________________________________________\n");
  console.log("[ ] 5. Evidence Findability: Legitimate Tier-1 pivot trails exist to prove disposition.");
  console.log("    Notes: _____________________________________________________________________\n");
  console.log("[ ] 6. Benign-Twin Fairness: Twins share structure but differ in findable evidence.");
  console.log("    Notes: _____________________________________________________________________\n");
  console.log("[ ] 7. Debrief Accuracy: Debrief explanations teach correct analyst investigation steps.");
  console.log("    Notes: _____________________________________________________________________\n");

  console.log("PRACTITIONER SIGN-OFF:");
  console.log("Reviewer Name: ___________________________  Date: ______________________________");
  console.log("Review Status Bump: [ ] Draft -> [ ] Practitioner-Reviewed");
  console.log("Required Reviewer Notes for bump (must be committed to metadata.reviewerNotes):");
  console.log("________________________________________________________________________________\n");

  // 4. Save Confidential Ground Truth Outside Repo
  const tmpDir = path.join(os.tmpdir(), "cyberblade-soc-review");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const answerFilePath = path.join(tmpDir, `ground-truth-${targetId}.txt`);

  let answerContent = "================================================================================\n";
  answerContent += "*** CONFIDENTIAL GROUND TRUTH - DO NOT DISTRIBUTE TO LEARNERS ***\n";
  answerContent += `Target Scenario / Shift: ${targetTitle} [${targetId}]\n`;
  answerContent += `Generated at: ${new Date().toISOString()}\n`;
  answerContent += "================================================================================\n\n";

  for (let vIdx = 0; vIdx < sampleVariants.length; vIdx++) {
    const sc = sampleVariants[vIdx];
    answerContent += `--- VARIANT ${vIdx + 1} OF ${count} [Seed: ${sc.seed}] ---\n`;
    answerContent += `Incidents Ground Truth (${sc.groundTruth.incidents.length} total):\n`;
    for (const inc of sc.groundTruth.incidents) {
      answerContent += `  [Incident ${inc.id}] ${inc.title}\n`;
      answerContent += `    Category:     ${inc.category}\n`;
      answerContent += `    Root Cause:   ${inc.rootCause}\n`;
      answerContent += `    MITRE ATT&CK: ${inc.mitre.join(", ")}\n`;
      answerContent += `    True Positive Alerts: ${inc.truePositiveAlertIds.join(", ")}\n`;
    }
    answerContent += `\nTrue Positive Alert Dispositions:\n`;
    for (const a of sc.alerts.filter((x) => x.groundTruth.kind === "true_positive")) {
      answerContent += `  [${a.id}] ${a.ruleName} -> Disposition: ${a.groundTruth.correctDisposition} | Severity: ${a.groundTruth.correctSeverity} | Escalate: ${a.groundTruth.correctEscalation}\n`;
      answerContent += `        Debrief: ${a.groundTruth.debrief}\n`;
    }
    answerContent += "\n";
  }

  fs.writeFileSync(answerFilePath, answerContent, "utf8");

  console.log("================================================================================");
  console.log(`[CONFIDENTIAL] Ground truth answers exported OUTSIDE repository to:`);
  console.log(`  ${answerFilePath}`);
  console.log("================================================================================\n");

  return 0;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});

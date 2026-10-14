import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { createEmptyReportData } from "@/lib/lab-engine/soc/reports/defaults";
import type { ReportTemplate, SocReportData } from "@/lib/lab-engine/soc/reports/types";
import { buildAiGradingInput } from "@/lib/lab-engine/soc/ai-grading/boundary";
import { scanForInjection } from "@/lib/lab-engine/soc/ai-grading/injection-signals";
import { loadAiGradingConfig, loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import type { AiCriterionId } from "@/lib/lab-engine/soc/ai-grading/types";
import { buildPrefilterContext } from "@/lib/lab-engine/soc/ai-grading/session";

export function loadTemplate(): ReportTemplate {
  const raw = fs.readFileSync(path.resolve("content/soc/report-templates/incident-report-l1.yaml"), "utf8");
  return parseYaml(raw) as ReportTemplate;
}

export const FACTS = {
  title: "Morning Shift: Invoice Lure",
  briefing: "You are on the day shift. Several email and sign-in alerts arrived for the finance team.",
};

/** A hand-written, fully synthetic report (fictional people, reserved domains, documentation IPs). */
export function sampleReport(): SocReportData {
  const r = createEmptyReportData("op_kavya", "CASE-0042", "Credential phishing against finance user");
  r.executiveSummary =
    "At 09:12 UTC user a.mehta opened a lure from billing-notice.example.net and entered credentials. " +
    "At 11:40 UTC the account signed in from 198.51.100.23 because the attacker reused the stolen password. " +
    "The account is now disabled and no other users are confirmed affected.";
  r.verdict.justification =
    "True positive because alt-019 shows a sign-in from 198.51.100.23 and alt-021 shows a new forwarding rule four minutes later on the same account.";
  r.attackNarrative =
    "The user received an invoice email (alt-011) and clicked the link to billing-notice.example.net. " +
    "The page collected the password. Two hours later the attacker signed in (alt-019) and created a mailbox forwarding rule (alt-021), which shows intent to keep access.";
  r.timeline = [
    { id: "t1", timestampUtc: "2026-10-12T09:12:00Z", rawTimestamp: "", timezone: "UTC", description: "User opened lure email", dataOrigin: "email", evidenceRef: "alert:alt-011" },
    { id: "t2", timestampUtc: "2026-10-12T11:40:00Z", rawTimestamp: "", timezone: "UTC", description: "Sign-in from new address", dataOrigin: "auth", evidenceRef: "alert:alt-019" },
  ];
  r.iocs = [
    { id: "i1", type: "domain", value: "billing-notice[.]example[.]net", role: "delivery", evidenceRefs: ["alert:alt-011"], notes: "Lure landing page that harvested the password." },
  ];
  r.actions = [
    { actionId: "disable-account", actionName: "Disable user account", category: "containment", priority: 1, rationale: "Stops the attacker's active session because the password is known to them." },
    { actionId: "remove-rule", actionName: "Remove forwarding rule", category: "eradication", priority: 2, rationale: "Export the rule first so Tier-2 keeps the evidence, then delete it." },
  ];
  r.escalation = {
    requiresEscalation: true,
    targetTeam: "Tier-2 Incident Response",
    urgency: "priority",
    handoffSummary:
      "a.mehta credentials phished and used from 198.51.100.23; forwarding rule exported then removed; account disabled. Open question: other recipients of the same lure. Request: search mailboxes for the sender domain.",
  };
  r.lessonsLearned = "Add a mail rule that flags newly registered sender domains so similar lures are quarantined.";
  return r;
}

export function prepared(report: SocReportData = sampleReport(), template = loadTemplate()) {
  const built = buildAiGradingInput(report, FACTS, template, { learnerHandles: ["op_kavya"] });
  const injection = scanForInjection(built.input.fields, built.invisibleCharsRemoved);
  return { ...built, injection, template };
}

export function criterion(id: AiCriterionId) {
  const c = loadAiRubric().criteria.find((x) => x.id === id);
  if (!c) throw new Error(`no criterion ${id}`);
  return c;
}

export function gradeArgsFor(id: AiCriterionId, report: SocReportData = sampleReport()) {
  const p = prepared(report);
  const crit = criterion(id);
  const config = loadAiGradingConfig();
  return {
    criterion: crit,
    input: p.input,
    injection: p.injection,
    prefilter: buildPrefilterContext(crit, p.template),
    config,
    versions: { aiRubricVersion: loadAiRubric().version, promptVersion: config.promptVersion },
  };
}

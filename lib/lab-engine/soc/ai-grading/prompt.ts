/**
 * Builds the two prompt strings for ONE criterion from the versioned template files.
 * Learner text is fenced with per-request random delimiters and labelled untrusted;
 * a per-request canary token lets us detect output that obeyed an injected instruction.
 */
import { createHash, randomBytes } from "node:crypto";
import { loadPromptTemplate } from "./config";
import type { AiGradingInput, AiReportField, AiRubricCriterion } from "./types";

export const FIELD_LABELS: Record<AiReportField, string> = {
  executiveSummary: "Executive summary",
  attackNarrative: "Attack narrative",
  verdictJustification: "Verdict justification",
  timelineDescriptions: "Timeline entries",
  iocNotes: "Indicator notes",
  lessonsLearned: "Lessons learned",
  actions: "Recommended actions",
  escalationTeam: "Escalation target",
  escalationUrgency: "Escalation urgency",
  handoffSummary: "Handoff summary",
};

/** Where each field's text sits inside the fenced report block (for span lookup). */
export interface FieldSegment {
  field: AiReportField;
  text: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  segments: FieldSegment[];
  canary: string;
  /** Hash of everything that determines the grade (excludes nonce and canary). */
  inputHash: string;
  /** Hash of the exact strings sent (stored next to raw output for audit). */
  promptHash: string;
}

export interface PromptSecrets {
  nonce: string;
  canary: string;
}

export function newPromptSecrets(): PromptSecrets {
  return { nonce: randomBytes(6).toString("hex"), canary: `CANARY-${randomBytes(8).toString("hex")}` };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`prompt placeholder ${key} has no value`);
    return values[key];
  });
}

function formatBands(criterion: AiRubricCriterion): string {
  return criterion.bands
    .map(
      (b) =>
        `Band ${b.band} (${b.label}): ${b.descriptor}\n  Synthetic example: "${b.anchors[0]}"\n  Synthetic example: "${b.anchors[1]}"`,
    )
    .join("\n");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function computeInputHash(
  criterion: AiRubricCriterion,
  input: AiGradingInput,
  versions: { aiRubricVersion: string; promptVersion: string },
): string {
  const payload = {
    c: criterion.id,
    v: versions,
    f: criterion.fields.map((f) => [f, input.fields[f] ?? ""]),
    s: input.scenarioFacts,
    g: criterion.fields.map((f) => input.templateGuidance[f] ?? ""),
  };
  return sha256(JSON.stringify(payload));
}

export function buildCriterionPrompt(
  criterion: AiRubricCriterion,
  input: AiGradingInput,
  versions: { aiRubricVersion: string; promptVersion: string },
  secrets: PromptSecrets = newPromptSecrets(),
): BuiltPrompt {
  const fenceOpen = `<<<REPORT-${secrets.nonce}>>>`;
  const fenceClose = `<<<END-REPORT-${secrets.nonce}>>>`;
  const segments: FieldSegment[] = criterion.fields
    .map((field) => ({ field, text: input.fields[field] ?? "" }))
    .filter((s) => s.text.trim());

  const reportText = segments.map((s) => `[${FIELD_LABELS[s.field]}]\n${s.text}`).join("\n\n");
  const guidance = [...new Set(criterion.fields.map((f) => input.templateGuidance[f]).filter(Boolean))].join("\n");

  const system = fill(loadPromptTemplate("system", versions.promptVersion), {
    FENCE_OPEN: fenceOpen,
    FENCE_CLOSE: fenceClose,
    CANARY: secrets.canary,
  });
  const user = fill(loadPromptTemplate("user", versions.promptVersion), {
    CRITERION_TITLE: criterion.title,
    CRITERION_QUESTION: criterion.question,
    BANDS: formatBands(criterion),
    SCENARIO_FACTS: input.scenarioFacts || "(none)",
    TEMPLATE_GUIDANCE: guidance || "(none)",
    SECTION_LIST: segments.map((s) => FIELD_LABELS[s.field]).join(", ") || "(empty)",
    FENCE_OPEN: fenceOpen,
    FENCE_CLOSE: fenceClose,
    REPORT_TEXT: reportText,
  });

  return {
    system,
    user,
    segments,
    canary: secrets.canary,
    inputHash: computeInputHash(criterion, input, versions),
    promptHash: sha256(`${system}\n---\n${user}`),
  };
}

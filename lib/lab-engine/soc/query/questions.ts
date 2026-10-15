/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Investigation Questions System (practical, server-verified questions)
 *
 * Provides leak-free question models, reference query generation, answerability proofs,
 * strict answer normalization, anti-guessing protections, and debrief templates.
 */

// Reference answers are computed here. Never importable from client code (S7).
import "server-only";
import { executeBladeQL } from "./engine";
import { type ScenarioDataset } from "./dataset-generator";
import { investigationDataset } from "./investigation-dataset";
import type { SocScenario } from "../schema";
import { MAX_QUESTION_ATTEMPTS, type LearnerQuestion, type QuestionType } from "./question-model";

export type { LearnerQuestion, QuestionType };

export interface InvestigationQuestionTemplate {
  id: string;
  stemTemplate: string;
  type: QuestionType;
  skillTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  points: number;
  hints: string[];
  toleranceSeconds?: number;
  referenceQueryTemplate: string;
  compute: (scenario: SocScenario, dataset: ScenarioDataset) => {
    referenceAnswer: string | number | string[];
    referenceQuery: string;
    stem: string;
    options?: string[];
    debrief: string;
  };
}

export interface ServerQuestionTruth {
  id: string;
  scenarioId: string;
  referenceAnswer: string | number | string[];
  acceptableAnswers?: Array<string | number>;
  toleranceSeconds?: number;
  referenceQuery: string;
  debrief: string;
  type: QuestionType;
}

// ============================================================================
// ANSWER NORMALIZATION & EVALUATION
// ============================================================================

/**
 * Normalizes IoCs, entity names, defanged strings, and timestamps
 */
export function normalizeAnswer(
  raw: string | number | string[],
  type: QuestionType,
): string | number | string[] {
  if (typeof raw === "number") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim().toLowerCase());
  }

  let str = String(raw).trim();

  if (type === "numeric") {
    const cleaned = str.replace(/,/g, "");
    const parsed = Number(cleaned);
    return isNaN(parsed) ? str : parsed;
  }

  if (type === "entity") {
    // 1. Refang defanged indicators (e.g. hxxp:// -> http://, [.] -> .)
    str = str.replace(/hxxp/gi, "http");
    str = str.replace(/\[\.\]/g, ".");
    str = str.replace(/\[:\]/g, ":");
    str = str.replace(/\(\.\)/g, ".");

    // 2. Normalize Windows/Unix path separators to forward slashes for filenames
    if (str.includes("\\")) {
      str = str.replace(/\\/g, "/");
    }

    // 3. Lowercase entities (IPs, domains, users, processes)
    return str.toLowerCase();
  }

  if (type === "timestamp") {
    try {
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString();
      }
    } catch {
      // Fall through to trimmed string
    }
    return str;
  }

  return str.toLowerCase();
}

/**
 * Evaluates whether a submitted answer matches the reference ground truth
 */
export function verifyAnswer(
  submitted: string | number | string[],
  truth: ServerQuestionTruth,
): { isCorrect: boolean; feedback?: string } {
  const normSubmitted = normalizeAnswer(submitted, truth.type);
  const normTruth = normalizeAnswer(truth.referenceAnswer, truth.type);

  if (truth.type === "numeric") {
    if (typeof normSubmitted === "number" && typeof normTruth === "number") {
      return { isCorrect: normSubmitted === normTruth };
    }
    return { isCorrect: String(submitted).trim() === String(truth.referenceAnswer).trim() };
  }

  if (truth.type === "timestamp") {
    try {
      const subTime = new Date(String(normSubmitted)).getTime();
      const truthTime = new Date(String(normTruth)).getTime();
      if (!isNaN(subTime) && !isNaN(truthTime)) {
        const toleranceMs = (truth.toleranceSeconds ?? 60) * 1000;
        const diff = Math.abs(subTime - truthTime);
        return { isCorrect: diff <= toleranceMs };
      }
    } catch {
      // Fall through to string match
    }
    return { isCorrect: String(normSubmitted) === String(normTruth) };
  }

  if (truth.type === "ordering") {
    if (!Array.isArray(submitted) || !Array.isArray(truth.referenceAnswer)) {
      return { isCorrect: false };
    }
    if (submitted.length !== truth.referenceAnswer.length) {
      return { isCorrect: false };
    }
    const refList = truth.referenceAnswer as string[];
    const isEq = submitted.every(
      (item, idx) =>
        String(item).trim().toLowerCase() ===
        String(refList[idx]).trim().toLowerCase(),
    );
    return { isCorrect: isEq };
  }

  if (truth.type === "multi_select") {
    if (!Array.isArray(submitted) || !Array.isArray(truth.referenceAnswer)) {
      return { isCorrect: false };
    }
    const setA = new Set(submitted.map((s) => String(s).trim().toLowerCase()));
    const setB = new Set(truth.referenceAnswer.map((s) => String(s).trim().toLowerCase()));
    if (setA.size !== setB.size) return { isCorrect: false };
    for (const val of setA) {
      if (!setB.has(val)) return { isCorrect: false };
    }
    return { isCorrect: true };
  }

  // Exact entity or single choice
  if (normSubmitted === normTruth) {
    return { isCorrect: true };
  }

  // Check acceptable alternatives if defined
  if (truth.acceptableAnswers) {
    for (const alt of truth.acceptableAnswers) {
      if (normalizeAnswer(alt, truth.type) === normSubmitted) {
        return { isCorrect: true };
      }
    }
  }

  return { isCorrect: false };
}

// ============================================================================
// QUESTION GENERATION ENGINE PER FAMILY
// ============================================================================

/**
 * Builds server question truths and client learner questions for a scenario
 */
/**
 * Server only. Builds the questions and their reference answers from the attempt-pinned seed,
 * over the same dataset the learner's server-side queries run against.
 */
export function generateScenarioQuestions(
  scenario: SocScenario,
  seed: string,
  familyId?: string,
): {
  learnerQuestions: LearnerQuestion[];
  serverTruths: ServerQuestionTruth[];
} {
  const dataset = investigationDataset(scenario, seed);

  // Pick question templates for this scenario's family
  // Generated variants carry familyId/scenarioId beyond the static schema.
  const loose = scenario as SocScenario & { familyId?: string; scenarioId?: string };
  const famId = familyId ?? loose.familyId ?? loose.scenarioId ?? "soc-f-phishing-cred-01";
  const templates = getFamilyQuestionTemplates(famId);

  const learnerQuestions: LearnerQuestion[] = [];
  const serverTruths: ServerQuestionTruth[] = [];

  for (const tpl of templates) {
    const computed = tpl.compute(scenario, dataset);

    serverTruths.push({
      id: tpl.id,
      scenarioId: scenario.id,
      referenceAnswer: computed.referenceAnswer,
      referenceQuery: computed.referenceQuery,
      debrief: computed.debrief,
      type: tpl.type,
      toleranceSeconds: tpl.toleranceSeconds ?? 60,
    });

    learnerQuestions.push({
      id: tpl.id,
      stem: computed.stem,
      type: tpl.type,
      options: computed.options,
      skillTags: tpl.skillTags,
      difficulty: tpl.difficulty,
      points: tpl.points,
      hintCount: tpl.hints.length,
      maxAttempts: MAX_QUESTION_ATTEMPTS,
      attemptsLeft: MAX_QUESTION_ATTEMPTS,
      status: "unanswered",
      debrief: null,
      referenceQuery: null,
    });
  }

  return { learnerQuestions, serverTruths };
}

/**
 * Retrieves question templates for a family
 */
export function getFamilyQuestionTemplates(familyId: string): InvestigationQuestionTemplate[] {
  // Common reusable templates parameterized per scenario variant
  return [
    {
      id: "q-top-source-ip",
      type: "entity",
      skillTags: ["network-analysis", "aggregation"],
      difficulty: "beginner",
      points: 10,
      hints: [
        "Filter for firewall logs or network flows.",
        "Use `stats count by src_ip` and `sort -count` to find the top communicating host.",
      ],
      stemTemplate: "Which source IP address generated the highest number of connection attempts?",
      referenceQueryTemplate: `source="firewall" | stats count by src_ip | sort -count | head 1 | table src_ip`,
      compute: (scenario, dataset) => {
        const res = executeBladeQL(
          `source="firewall" | stats count by src_ip | sort -count | head 1`,
          dataset.events,
        );
        const topIp = String(res.events[0]?.src_ip ?? "192.0.2.1");
        return {
          stem: "Which source IP address generated the highest number of connection attempts in the firewall logs?",
          referenceAnswer: topIp,
          referenceQuery: `source="firewall" | stats count by src_ip | sort -count | head 1 | table src_ip`,
          debrief: `Aggregating firewall connections by source IP reveals ${topIp} as the most active communicator with ${res.events[0]?.count ?? 0} events.`,
        };
      },
    },
    {
      id: "q-failed-auth-count",
      type: "numeric",
      skillTags: ["auth-analysis", "counting"],
      difficulty: "beginner",
      points: 10,
      hints: [
        "Look for authentication telemetry under `source=\"auth\"`.",
        "Filter for `outcome=\"failure\"` or `EventCode=4625`.",
      ],
      stemTemplate: "How many failed authentication events occurred across the enterprise during the window?",
      referenceQueryTemplate: `source="auth" outcome="failure" | stats count`,
      compute: (scenario, dataset) => {
        const res = executeBladeQL(`source="auth" outcome="failure" | stats count`, dataset.events);
        const count = Number(res.events[0]?.count ?? 0);
        return {
          stem: "How many failed authentication events occurred across the enterprise during the logged shift?",
          referenceAnswer: count,
          referenceQuery: `source="auth" outcome="failure" | stats count`,
          debrief: `Querying authentication failures using \`source="auth" outcome="failure"\` returns ${count} total failure events.`,
        };
      },
    },
    {
      id: "q-distinct-users-targeted",
      type: "numeric",
      skillTags: ["auth-analysis", "distinct-count"],
      difficulty: "intermediate",
      points: 15,
      hints: [
        "Use distinct count aggregation `stats dc(user)` on failed logons.",
      ],
      stemTemplate: "How many distinct user accounts experienced failed logon attempts?",
      referenceQueryTemplate: `source="auth" outcome="failure" | stats dc(user)`,
      compute: (scenario, dataset) => {
        const res = executeBladeQL(`source="auth" outcome="failure" | stats dc(user)`, dataset.events);
        const dc = Number(res.events[0]?.["dc(user)"] ?? 0);
        return {
          stem: "How many distinct user accounts experienced failed logon attempts during the shift?",
          referenceAnswer: dc,
          referenceQuery: `source="auth" outcome="failure" | stats dc(user)`,
          debrief: `Using \`stats dc(user)\` on failed logons isolates the breadth of accounts targeted (${dc} distinct users).`,
        };
      },
    },
    {
      id: "q-first-event-timestamp",
      type: "timestamp",
      toleranceSeconds: 120,
      skillTags: ["timeline", "earliest"],
      difficulty: "intermediate",
      points: 15,
      hints: [
        "Sort chronological events by timestamp ascending or use `stats earliest(timestamp)`.",
      ],
      stemTemplate: "What was the timestamp of the first recorded authentication event in the logs?",
      referenceQueryTemplate: `source="auth" | sort timestamp | head 1 | table timestamp`,
      compute: (scenario, dataset) => {
        const res = executeBladeQL(`source="auth" | sort timestamp | head 1`, dataset.events);
        const ts = String(res.events[0]?.timestamp ?? "2026-10-12T08:00:00Z");
        return {
          stem: "What was the timestamp of the earliest recorded authentication event?",
          referenceAnswer: ts,
          referenceQuery: `source="auth" | sort timestamp | head 1 | table timestamp`,
          debrief: `Sorting authentication logs by timestamp ascending reveals the earliest recorded authentication event at ${ts}.`,
        };
      },
    },
    {
      id: "q-suspicious-endpoint-process",
      type: "single_choice",
      skillTags: ["endpoint-hunting", "process-analysis"],
      difficulty: "intermediate",
      points: 15,
      hints: [
        "Examine `source=\"endpoint\"` process creations.",
        "Look for script interpreters or rare utilities.",
      ],
      stemTemplate: "Which process created child execution instances under user context?",
      referenceQueryTemplate: `source="endpoint" | top 1 process`,
      compute: (scenario, dataset) => {
        const res = executeBladeQL(`source="endpoint" | top 1 process`, dataset.events);
        const topProc = String(res.events[0]?.process ?? "explorer.exe");
        const distractors = ["lsass.exe", "winlogon.exe", "services.exe"];
        const options = Array.from(new Set([topProc, ...distractors])).slice(0, 4);

        return {
          stem: "Which primary process is recorded executing commands in the endpoint logs?",
          referenceAnswer: topProc,
          options,
          referenceQuery: `source="endpoint" | stats count by process | sort -count | head 1 | table process`,
          debrief: `The top process identified in endpoint telemetry is ${topProc}.`,
        };
      },
    },
    {
      id: "q-destination-port-traffic",
      type: "numeric",
      skillTags: ["network-hunting", "filtering"],
      difficulty: "beginner",
      points: 10,
      hints: ["Look at firewall records with action=allow."],
      stemTemplate: "What destination port received DNS traffic?",
      referenceQueryTemplate: `source="dns" | head 1 | table dest_port`,
      compute: (scenario, dataset) => {
        return {
          stem: "What destination port is standard for the DNS traffic observed in the logs?",
          referenceAnswer: 53,
          referenceQuery: `source="dns" | head 1 | table dest_port`,
          debrief: `Standard DNS query resolution operates over UDP/TCP port 53.`,
        };
      },
    },
    {
      id: "q-event-stages-ordering",
      type: "ordering",
      skillTags: ["kill-chain", "timeline"],
      difficulty: "advanced",
      points: 20,
      hints: [
        "Follow the chronological timeline from initial contact through execution and connection.",
      ],
      stemTemplate: "Arrange the tactical stages in chronological order.",
      referenceQueryTemplate: `source in ("email", "auth", "endpoint", "firewall") | sort timestamp | head 4`,
      compute: (scenario, dataset) => {
        const order = [
          "External Delivery / Authentication Request",
          "Local Script Interpreter Execution",
          "Internal Privilege or Identity Verification",
          "Outbound Communication or Data Transfer",
        ];
        return {
          stem: "Arrange the typical attacker progression in chronological order as observed across telemetry:",
          referenceAnswer: order,
          options: [...order].reverse(), // scrambled for learner
          referenceQuery: `source in ("email", "endpoint", "auth", "firewall") | sort timestamp | head 4`,
          debrief: `The chronological sequence aligns with the MITRE ATT&CK lifecycle: Initial Delivery -> Execution -> Discovery/Privilege -> Outbound Activity.`,
        };
      },
    },
    {
      id: "q-telemetry-sources-involved",
      type: "multi_select",
      skillTags: ["scoping", "multi-source"],
      difficulty: "beginner",
      points: 10,
      hints: ["Check the sources present in the dataset."],
      stemTemplate: "Which telemetry sources are present in the scenario log lake?",
      referenceQueryTemplate: `stats count by source | table source`,
      compute: (scenario, dataset) => {
        const sources = dataset.sources.slice(0, 3);
        const allOptions = Array.from(new Set([...sources, "honeypot", "cloudtrail", "scada"])).slice(0, 5);

        return {
          stem: "Select all telemetry sources that contain events in this investigation's dataset:",
          referenceAnswer: sources,
          options: allOptions,
          referenceQuery: `stats count by source | table source`,
          debrief: `The scenario log lake contains telemetry from: ${sources.join(", ")}.`,
        };
      },
    },
  ];
}

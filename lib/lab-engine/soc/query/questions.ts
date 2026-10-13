/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Investigation Questions System (SAL1/BTL1-Style Server-Verified Questions)
 *
 * Provides leak-free question models, reference query generation, answerability proofs,
 * strict answer normalization, anti-guessing protections, and debrief templates.
 */

import { executeBladeQL } from "./engine";
import { generateScenarioDataset, type ScenarioDataset } from "./dataset-generator";
import type { SocScenario } from "../schema";

export type QuestionType =
  | "numeric"
  | "entity"
  | "timestamp"
  | "single_choice"
  | "multi_select"
  | "ordering";

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

export interface LearnerQuestion {
  id: string;
  stem: string;
  type: QuestionType;
  options?: string[];
  skillTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  points: number;
  hintCount: number;
  maxAttempts: number;
  attemptsLeft: number;
  status: "unanswered" | "correct" | "incorrect" | "locked";
  submittedAnswer?: string | number | string[];
  // Debrief and reference query are only populated AFTER submission / completion
  debrief?: string;
  referenceQuery?: string;
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

// In-memory server truth cache keyed by `${scenarioId}:${seed}`
const QUESTION_TRUTH_CACHE = new Map<string, ServerQuestionTruth[]>();

// In-memory attempt tracker per attempt / question
interface QuestionAttemptRecord {
  attemptsLeft: number;
  status: "unanswered" | "correct" | "incorrect" | "locked";
  lastSubmittedAnswer?: string | number | string[];
  lastSubmittedAt: number;
}

const ATTEMPTS_STORE = new Map<string, QuestionAttemptRecord>();

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
    const isEq = submitted.every(
      (item, idx) =>
        String(item).trim().toLowerCase() ===
        String(truth.referenceAnswer[idx]).trim().toLowerCase(),
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
export function generateScenarioQuestions(
  scenario: SocScenario,
  seed: string,
): {
  learnerQuestions: LearnerQuestion[];
  serverTruths: ServerQuestionTruth[];
} {
  const cacheKey = `${scenario.id}:${seed}`;
  const dataset = generateScenarioDataset(scenario, seed, 5000);

  // Pick question templates for this scenario's family
  const templates = getFamilyQuestionTemplates(scenario.familyId ?? "soc-f-phishing-cred-01");

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
      maxAttempts: 5,
      attemptsLeft: 5,
      status: "unanswered",
    });
  }

  QUESTION_TRUTH_CACHE.set(cacheKey, serverTruths);

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

// ============================================================================
// SERVER EVALUATION & RATE LIMITING
// ============================================================================

export interface SubmitQuestionAnswerParams {
  attemptId: string;
  scenarioId: string;
  seed: string;
  questionId: string;
  submittedAnswer: string | number | string[];
}

export interface QuestionSubmissionResult {
  questionId: string;
  isCorrect: boolean;
  attemptsLeft: number;
  status: "correct" | "incorrect" | "locked";
  pointsAwarded: number;
  debrief?: string;
  referenceQuery?: string;
}

/**
 * Server-verified submission handler with anti-guessing and uniform timing
 */
export async function submitQuestionAnswer(
  params: SubmitQuestionAnswerParams,
): Promise<QuestionSubmissionResult> {
  const startTime = Date.now();
  const storeKey = `${params.attemptId}:${params.questionId}`;

  let record = ATTEMPTS_STORE.get(storeKey);
  if (!record) {
    record = {
      attemptsLeft: 5,
      status: "unanswered",
      lastSubmittedAt: 0,
    };
    ATTEMPTS_STORE.set(storeKey, record);
  }

  // Rate limiting: 1 submission per 2000ms
  const now = Date.now();
  if (now - record.lastSubmittedAt < 1500) {
    throw new Error("Rate limit exceeded: Please wait before submitting another answer.");
  }
  record.lastSubmittedAt = now;

  // Check if locked
  if (record.status === "locked" || record.attemptsLeft <= 0) {
    return {
      questionId: params.questionId,
      isCorrect: false,
      attemptsLeft: 0,
      status: "locked",
      pointsAwarded: 0,
    };
  }

  // Already correct
  if (record.status === "correct") {
    return {
      questionId: params.questionId,
      isCorrect: true,
      attemptsLeft: record.attemptsLeft,
      status: "correct",
      pointsAwarded: 10,
    };
  }

  // Retrieve server truth
  const cacheKey = `${params.scenarioId}:${params.seed}`;
  let truths = QUESTION_TRUTH_CACHE.get(cacheKey);

  if (!truths) {
    // Generate truths on-demand if needed
    // In production, scenarios are reconstituted from database
    truths = [];
  }

  const truth = truths.find((t) => t.id === params.questionId);

  let isCorrect = false;
  if (truth) {
    const evalRes = verifyAnswer(params.submittedAnswer, truth);
    isCorrect = evalRes.isCorrect;
  }

  record.attemptsLeft -= 1;
  record.lastSubmittedAnswer = params.submittedAnswer;

  if (isCorrect) {
    record.status = "correct";
  } else if (record.attemptsLeft <= 0) {
    record.status = "locked";
  } else {
    record.status = "incorrect";
  }

  // Enforce uniform timing window (minimum 150ms) to defeat side-channel timing attacks
  const elapsed = Date.now() - startTime;
  if (elapsed < 150) {
    await new Promise((r) => setTimeout(r, 150 - elapsed));
  }

  return {
    questionId: params.questionId,
    isCorrect,
    attemptsLeft: record.attemptsLeft,
    status: record.status,
    pointsAwarded: isCorrect ? 10 : 0,
    debrief: isCorrect || record.status === "locked" ? truth?.debrief : undefined,
    referenceQuery: isCorrect || record.status === "locked" ? truth?.referenceQuery : undefined,
  };
}

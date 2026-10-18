/**
 * Post-build leak scan. Fails when anything that must stay on the server shows up in client
 * JavaScript, prerendered HTML or RSC/hydration payloads: question truths, ground-truth keys,
 * seeds, family-generation internals, AI prompts/canaries, provider secrets or real flag values.
 * Pure (fs only) so it can be tested against planted fixtures.
 */
import fs from "node:fs";
import path from "node:path";

export interface LeakRule {
  id: string;
  re: RegExp;
  /** Never echo the match (it is a real secret value). */
  redact?: boolean;
}

export const LEAK_RULES: LeakRule[] = [
  // Answer/truth computation and ground-truth keys
  { id: "question-truths", re: /serverTruths|referenceAnswer|acceptableAnswers|generateScenarioQuestions/ },
  // Keys that never leave the server, even after submission. (Post-submission results such as
  // per-alert correct dispositions and the model report are intentional reveals and are not listed.)
  { id: "ground-truth-keys", re: /reportGroundTruth|truePositiveAlertIds|isTruePositive|harmfulActionIds|requiredActionIds|acceptableTechniqueIds|\\?"groundTruth\\?"\s*:/ },
  { id: "truth-generators", re: /generateSocVariant|synthesizeReportGroundTruth|composeShiftScenario|generateScenarioDataset|investigationDataset/ },
  // Lesson micro-exercise answer keys (content/tracks/**/*.exercises.yaml `accept` lists) stay server-side.
  { id: "exercise-keys", re: /\\?"accept\\?"\s*:\s*\[/ },
  { id: "hidden-entity-roles", re: /attacker_infra|benign_business|shared_infra/ },
  // SOC exam answer keys and graders (Stage 1). Exam seeds are covered by seed-in-payload; the
  // post-submission review is rendered on the server, so none of these names belong in client code.
  { id: "exam-keys", re: /knowledge-bank(-l2)?\.yaml|loadKnowledgeBank|knowledgeBankForFormat|gradeKnowledgeAnswer|knowledgeItemReview|drawKnowledgeItems|correctOptionIds|objectiveAlignment|buildExamResult|handoffChecks|evaluateReadiness/ },
  // Pentest exam answer keys and generators
  { id: "pentest-exam-keys", re: /loadPentestKnowledgeBank|gradePentestKnowledgeAnswer|pentestKnowledgeItemReview|drawPentestKnowledgeItems|generatePentestExamScenario|gradeFindingAnswer|findingQuestionReview|buildPentestExamResult|evaluatePentestReadiness/ },
  // Pentest lab generators and server-side answer resolvers
  { id: "pentest-lab-answers", re: /pentest_osint_recon|pentest_nmap_scan|pentest_cleartext_creds|pentest_vuln_triage|pentest_web_sqli_union|pentest_web_sqli_blind|pentest_web_cmdi|pentest_web_xss|pentest_web_upload|pentest_web_idor|pentest_msf_exploit|pentest_hydra_brute|pentest_suid_privesc|pentest_cron_privesc|pentest_win_privesc|pentest_tunnel_triage|pentestCleartextCreds|pentestNmapScan|pentestOsint|pentestVulnTriage|netrange_foothold_privesc|netrange_web_cred_reuse|netrange_pivot_internal|netrange_windows_smb_privesc|netrange_mini_exam|netrangeFootholdPrivesc|netrangeWebCredReuse|netrangePivotInternal|netrangeWindowsSmbPrivesc|netrangeMiniExam/ },
  // Detection rule challenge ground truth, hold-out variants and scoping rubrics (Stage 1 L2).
  { id: "rule-ground-truth", re: /evaluateDetectionRuleChallenge|deriveHoldOutSeeds|holdOutEvents|benignEvents|scoping-report-l2-rubric/ },
  // Seeds and family internals
  // Matches plain JSON and the escaped JSON embedded in HTML hydration scripts (\"seed\":).
  { id: "seed-in-payload", re: /\\?"seed\\?"\s*:\s*\\?"/ },
  { id: "family-internals", re: /incidentTemplates|benignTemplates|rootCauseTemplate|debriefTemplates|variationAxes|distinguishingEvidence/ },
  // AI grading internals
  { id: "ai-prompts", re: /UNTRUSTED DATA|Never reveal or repeat this token|CANARY-[0-9a-f]{8,}|<<<REPORT-[0-9a-f]+>>>|insufficientInformation|evidenceSpans/ },
  // Secrets and real flag values (help text like CYBERBLADE{...} is allowed)
  { id: "secrets", re: /SUPABASE_SERVICE_ROLE_KEY|GROQ_API_KEY|GEMINI_API_KEY|gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/ },
  { id: "flag-values", re: /\b(?:CYBER)?BLADE\{[A-Za-z0-9_-]{6,}\}|\bFLAG\{[A-Za-z0-9_-]{6,}\}|\bPENTEST\{[A-Za-z0-9_-]{6,}\}/ },
];

/** Server-only variables whose actual values must never appear in client output. */
export const SERVER_SECRET_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "CAPTCHA_SECRET_KEY",
  "ERROR_REPORTER_DSN",
  "BACKUP_ENCRYPTION_KEY",
  "SUPABASE_DB_URL",
];

/** Rules matching the real values of server secrets set at scan time (run with the build's env). */
export function secretValueRules(env: Record<string, string | undefined> = process.env): LeakRule[] {
  return SERVER_SECRET_VARS.filter((n) => (env[n]?.length ?? 0) >= 16).map((n) => ({
    id: `secret-value:${n}`,
    re: new RegExp(env[n]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    redact: true,
  }));
}

export interface LeakHit {
  file: string;
  rule: string;
  excerpt: string;
}

const SCANNED = /\.(js|mjs|html|rsc|body|json|txt)$/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  if (fs.statSync(dir).isFile()) return SCANNED.test(dir) ? [dir] : [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : SCANNED.test(e.name) ? [p] : [];
  });
}

export function scanForLeaks(roots: string[], rules: LeakRule[] = LEAK_RULES): { files: number; hits: LeakHit[] } {
  const files = roots.flatMap(walk);
  const hits: LeakHit[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const rule of rules) {
      const m = rule.re.exec(text);
      if (m) {
        const at = m.index;
        const excerpt = rule.redact ? "[secret value withheld]" : text.slice(Math.max(0, at - 40), at + m[0].length + 40).replace(/\s+/g, " ");
        hits.push({ file, rule: rule.id, excerpt });
      }
    }
  }
  return { files: files.length, hits };
}

/** Client-reachable build output: browser chunks plus prerendered HTML/RSC (not server code). */
export function clientArtifactRoots(nextDir = ".next"): string[] {
  return [path.join(nextDir, "static"), ...walkDirsWithPayloads(path.join(nextDir, "server", "app"))];
}

function walkDirsWithPayloads(dir: string): string[] {
  // Only the prerendered outputs inside server/app (HTML, RSC, route bodies), never server JS.
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visit(p);
      else if (/\.(html|rsc|body)$/.test(e.name)) out.push(p);
    }
  };
  visit(dir);
  // Return files as single-file "roots" (walk() on a file path is handled below).
  return out;
}

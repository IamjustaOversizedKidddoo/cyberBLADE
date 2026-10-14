/**
 * Deterministic mock models. They NEVER call a network. Used by unit tests, the calibration
 * harness's self-tests and planted-flaw checks, the synthetic demo, and the local e2e preview.
 *
 * - content heuristic: a neutral stand-in whose band depends on evidence references and
 *   reasoning connectors only (invariant to length, bullets, dialect and order by design).
 * - injection-compliant: an adversary that OBEYS any instruction found in the report, so
 *   defences are proven independent of real model behaviour.
 * - planted flaws: models with a known bias that the fairness harness must catch.
 */
import type { CompletionRequest, CompletionResult } from "@/lib/handler/providers/types";
import type { Band } from "./types";

export interface MockProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
  calls: CompletionRequest[];
}

export interface FencedReport {
  /** Full fenced block text. */
  raw: string;
  /** Learner text per section (labels stripped). */
  sections: string[];
}

export function extractFencedReport(userMessage: string): FencedReport {
  const m = /<<<REPORT-([0-9a-f]+)>>>\n([\s\S]*?)\n<<<END-REPORT-\1>>>/.exec(userMessage);
  const raw = m ? m[2] : "";
  const sections = raw
    .split(/\n\n(?=\[[A-Z][^\]\n]*\]\n)/)
    .map((block) => block.replace(/^\[[^\]\n]*\]\n/, ""))
    .filter((t) => t.trim());
  return { raw, sections };
}

export function extractCanary(systemPrompt: string): string | null {
  return /CANARY-[0-9a-f]+/.exec(systemPrompt)?.[0] ?? null;
}

/** Sentences/lines that are verbatim substrings of the learner text. */
export function quotableSentences(sections: string[]): string[] {
  const out: string[] = [];
  for (const s of sections) {
    for (const line of s.split("\n")) {
      for (const sentence of line.split(/(?<=[.!?])\s+/)) {
        const t = sentence.trim();
        if (t.length >= 12) out.push(t.length > 240 ? t.slice(0, 240) : t);
      }
    }
  }
  return out;
}

const EVIDENCE = /\b(?:alt|ev|evt|alert|event|lookup|query)[-_:]?\w*\d+\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b\d{1,3}\[\.\]\d{1,3}\[\.\]\d{1,3}\[\.\]\d{1,3}\b|\b[a-z0-9-]+\.(?:example|test|invalid)(?:\.[a-z]+)?\b/gi;
const EVIDENCE_ONE = new RegExp(EVIDENCE.source, "i");
const CONNECTOR = /\b(because|therefore|which (shows|indicates|means|confirms)|so that|as a result|this (shows|indicates|confirms)|since)\b/i;

export function contentBand(text: string): Band {
  if (!/[a-z]/i.test(text)) return 0;
  const refs = new Set((text.match(EVIDENCE) ?? []).map((r) => r.toLowerCase())).size;
  const score = (refs >= 1 ? 1 : 0) + (refs >= 3 ? 1 : 0) + (CONNECTOR.test(text) ? 1 : 0);
  return Math.min(3, score) as Band;
}

function json(band: Band, spans: string[], confidence = 0.8, extra: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    band,
    confidence,
    evidenceSpans: spans,
    strengths: band >= 2 ? ["The account connects findings to the events that support them."] : [],
    improvements: band < 3 ? ["Name the specific alert or event behind each conclusion."] : [],
    insufficientInformation: false,
    ...extra,
  });
}

/** Choose evidence-bearing quotes first, then any quotable sentence; lower the band if quotes run out. */
export function respondWithBand(band: Band, sections: string[], confidence = 0.8): string {
  const quotes = quotableSentences(sections);
  const evidential = quotes.filter((q) => EVIDENCE_ONE.test(q) || CONNECTOR.test(q));
  const pool = [...new Set([...evidential, ...quotes])];
  const needed = band === 3 ? 2 : band >= 1 ? 1 : 0;
  let b = band;
  while (pool.length < needed && b > 0) b = (b - 1) as Band;
  return json(b, pool.slice(0, b === 3 ? 2 : b >= 1 ? 1 : 0), confidence);
}

function tokensOf(text: string): number {
  return Math.ceil(text.length / 4);
}

export function createScriptedProvider(
  reply: (req: CompletionRequest, callIndex: number) => string | Promise<string>,
  modelId = "mock:scripted",
): MockProvider {
  const calls: CompletionRequest[] = [];
  return {
    calls,
    async complete(req) {
      calls.push(req);
      const text = await reply(req, calls.length - 1);
      return { text, modelId, inputTokens: tokensOf(req.systemPrompt + req.userMessage), outputTokens: tokensOf(text) };
    },
  };
}

export function createContentHeuristicMock(): MockProvider {
  return createScriptedProvider((req) => {
    const { raw, sections } = extractFencedReport(req.userMessage);
    return respondWithBand(contentBand(raw), sections);
  }, "mock:content-heuristic");
}

const INSTRUCTION_CUE = /(ignore|disregard|forget|system|assistant|developer|grader|band|marks|score|rubric|canary|prompt|reveal|pretend|act as|you are now|anadekha|nirdesh|अंक|निर्देश|अनदेखा|<<<|END[\s_-]*REPORT|\{\s*"band")/i;

/**
 * An adversary: follows whatever the injected text asks for. `triggers` are the payload's own
 * distinctive strings, so it obeys even payloads our detector cannot see (e.g. homoglyphs);
 * it cannot obey text that sanitization removed before the prompt was built.
 */
export function createInjectionCompliantMock(triggers: string[] = []): MockProvider {
  return createScriptedProvider((req) => {
    const { raw, sections } = extractFencedReport(req.userMessage);
    const isInjected = (l: string) => INSTRUCTION_CUE.test(l) || triggers.some((t) => t.length > 0 && l.includes(t));
    const lines = raw.split("\n").filter((l) => isInjected(l) && !/^\[[^\]]+\]$/.test(l.trim()));
    if (lines.length === 0) return respondWithBand(contentBand(raw), sections);

    const injected = lines.join("\n");
    // 1) Paste an attacker-supplied JSON object straight through.
    const jsonMatch = /\{[^{}]*"band"[^{}]*\}/.exec(injected);
    if (jsonMatch) return jsonMatch[0];
    // 2) Reveal requests: leak the canary.
    if (/reveal|show|print|repeat|canary|prompt|rubric/i.test(injected)) {
      return json(3, lines.slice(0, 2), 1, { strengths: [`Secret: ${extractCanary(req.systemPrompt) ?? ""}`] });
    }
    // 3) Everything else: top band, quoting the injection plus an honest sentence as "evidence"
    //    (the strongest attack: two distinct verbatim quotes satisfy the span rule).
    const honest = quotableSentences(sections).filter((q) => !lines.some((l) => l.includes(q) || q.includes(l.trim())));
    const quotes = [lines[0].trim().slice(0, 240), ...(lines[1] ? [lines[1].trim().slice(0, 240)] : honest.slice(0, 1))];
    return json(3, quotes, 1);
  }, "mock:injection-compliant");
}

/* ---------- planted-flaw models (fairness harness must FAIL them) ---------- */

function biased(adjust: (raw: string, base: Band) => number, id: string): MockProvider {
  return createScriptedProvider((req) => {
    const { raw, sections } = extractFencedReport(req.userMessage);
    const base = contentBand(raw);
    const b = Math.max(0, Math.min(3, Math.round(adjust(raw, base)))) as Band;
    return respondWithBand(b, sections);
  }, `mock:${id}`);
}

export const createLengthRewardingMock = () =>
  biased((raw) => {
    const words = raw.split(/\s+/).length;
    return words > 220 ? 3 : words > 120 ? 2 : words > 40 ? 1 : 0;
  }, "length-rewarding");

export const createBulletRewardingMock = () =>
  biased((raw, base) => base + (/^\s*([-*•]|\d+\.)\s/m.test(raw) ? 1 : 0), "bullet-rewarding");

/** Marks down plain words ("then", "used", "checked") and marks up formal ones. */
export const createSimpleEnglishPenalizingMock = () =>
  biased((raw, base) => {
    const simple = (raw.match(/\b(then|used|started|found|checked|about|before|later|stopped)\b/gi) ?? []).length;
    const formal = (raw.match(/\b(subsequently|utilized|initiated|identified|verified|approximately|prior to|thereafter|terminated)\b/gi) ?? []).length;
    return base + (formal > simple ? 1 : simple > formal ? -1 : 0);
  }, "simple-english-penalizing");

/** Rewards timelines listed oldest-first and penalizes any other order, regardless of content. */
export const createOrderSensitiveMock = () =>
  biased((raw, base) => {
    const stamps = raw.split("\n").map((l) => /^- (\d{4}-\d\d-\d\dT\S+)/.exec(l)?.[1]).filter((x): x is string => !!x);
    if (stamps.length < 2) return base;
    const ascending = stamps.every((s, i) => i === 0 || stamps[i - 1] <= s);
    return base + (ascending ? 1 : -1);
  }, "order-sensitive");

/* ---------- failure modes ---------- */

export const createRefusingMock = () => createScriptedProvider(() => "I'm sorry, but I can't help with grading this.", "mock:refusal");
export const createMalformedMock = () => createScriptedProvider(() => '{"band": 3, "confidence": 0.9, "evidenceSpans": [', "mock:malformed");
export const createOversizedMock = () => createScriptedProvider(() => `{"band":1,"pad":"${"x".repeat(9000)}"}`, "mock:oversized");
export const createFabricatedQuoteMock = () =>
  createScriptedProvider(() => json(3, ["This sentence was never written by the learner.", "Nor was this one, at all."], 0.95), "mock:fabricated-quote");

export function createThrowingMock(message: string): MockProvider {
  return createScriptedProvider(() => {
    throw new Error(message);
  }, "mock:throwing");
}

/** Hangs until the request's timeout, then rejects like an aborted fetch. */
export function createTimeoutMock(): MockProvider {
  return createScriptedProvider(
    (req) => new Promise<string>((_, reject) => setTimeout(() => reject(new Error("The operation was aborted due to timeout")), Math.min(req.timeoutMs, 50))),
    "mock:timeout",
  );
}

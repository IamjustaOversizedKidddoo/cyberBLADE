/**
 * Detects instruction-like text inside learner reports. Detection only FLAGS (review queue,
 * not counted) and marks regions whose quotes may not be used as evidence. It never blocks
 * grading and is never the only defence: schema, quote checks, canary and caps still apply.
 */
import type { AiReportField } from "./types";

export type InjectionKind =
  | "instruction_override"
  | "role_spoof"
  | "fence_spoof"
  | "json_injection"
  | "score_begging"
  | "rubric_reveal"
  | "grader_address"
  | "encoded_blob"
  | "invisible_characters";

const PATTERNS: Array<{ kind: InjectionKind; re: RegExp }> = [
  { kind: "instruction_override", re: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(instructions?|prompts?|guidelines|rubric|directions|rules)\b/gi },
  { kind: "instruction_override", re: /\bnew (instructions?|rules?|task)\b\s*[:-]/gi },
  { kind: "instruction_override", re: /\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|earlier|above)\b/gi },
  { kind: "role_spoof", re: /\b(system|developer|assistant|grader)\s*(message|prompt|instructions?|override|note)\s*[:>\]]|\[(system|assistant|developer)\]|(^|\n)\s*#{1,3}\s*(system|assistant|developer)\b/gi },
  { kind: "role_spoof", re: /<\|?\s*(system|im[ _]start|im[ _]end|assistant|user)\s*\|?>|\[\/?(INST|SYS)\]|<<\/?SYS>>/gi },
  { kind: "role_spoof", re: /\b(you are now|act as|pretend (to be|you are)|roleplay as|from now on you)\b/gi },
  { kind: "fence_spoof", re: /<<<|>>>|\bEND[\s_-]*(OF[\s_-]*)?REPORT\b|<\/?\s*report\s*>|\bREPORT[\s_-]*(BEGIN|START|END)\b/gi },
  { kind: "json_injection", re: /\b(band|evidenceSpans|insufficientInformation)\b["'`]?\s*[:=]\s*["'\d[{tf]|["'`](confidence|strengths|improvements)["'`]\s*:/gi },
  { kind: "score_begging", re: /\b(give|award|assign|grade|rate|score|mark)\b[^.\n]{0,30}\b(full|max(imum)?|perfect|top|highest|maximum|best|high)\b[^.\n]{0,12}\b(marks?|score|band|points?|grade|rating)\b/gi },
  { kind: "score_begging", re: /\b(band|score|grade)\s*(of\s*)?(3|three|100)\b/gi },
  { kind: "score_begging", re: /\b(please|kindly)\b[^.\n]{0,40}\b(pass|full marks|high score|good grade)\b/gi },
  { kind: "score_begging", re: /\b(deserves?|worth|merits?|requesting|request|want|need)\b[^.\n]{0,30}\b(full|max(imum)?|perfect|top|highest|best)\b[^.\n]{0,12}\b(marks?|score|band|points?|grade|rating)\b/gi },
  { kind: "score_begging", re: /\b(full|maximum|perfect|top|highest)\s+(marks|band|points|grade)\b/gi },
  { kind: "rubric_reveal", re: /\b(reveal|show|print|repeat|output|display|leak|tell me|give me|what is)\b[^.\n]{0,30}\b(rubric|system prompt|prompt|instructions|canary|hidden|answer key|model report|secret|token)\b/gi },
  { kind: "grader_address", re: /\b(dear|hey|hi|attention|note (to|for))\b[^.\n]{0,12}\b(grader|ai|model|llm|assistant|chatgpt|claude|gemini|evaluator)\b/gi },
  // Hinglish (romanized Hindi) and Devanagari variants of the same requests.
  { kind: "instruction_override", re: /\b(ignore|anadekha|nazarandaaz)\s*(karo|kar do|kariye|kijiye|karein)\b|\b(pichhle|pichle|purane)\s*(instructions?|nirdesh|niyam)\b/gi },
  { kind: "score_begging", re: /\b(full|poore|pure|pura)\s*(marks?|ank|number|nambar)\s*(de|do|dedo|dena|dijiye|chahiye)\b/gi },
  { kind: "instruction_override", re: /(पिछले|पुराने)\s*(निर्देश|नियम)|निर्देशों?\s*को\s*(अनदेखा|नज़रअंदाज़|नजरअंदाज)|अनदेखा\s*कर/g },
  { kind: "score_begging", re: /(पूरे|पूरा|सबसे ज़्यादा|सबसे ज्यादा)\s*(अंक|नंबर|मार्क्स)/g },
  { kind: "role_spoof", re: /(सिस्टम|प्रणाली)\s*(संदेश|निर्देश)?\s*[:：]/g },
  { kind: "encoded_blob", re: /\b[A-Za-z0-9+/]{48,}={0,2}(?![A-Za-z0-9+/=])/g },
];

// Cyrillic/Greek letters that look like Latin ones. Folded 1:1 (same string length) for detection
// only, so match offsets still point at the learner's original text.
const CONFUSABLES: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ɡ": "g", "һ": "h", "ո": "n",
  "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "І": "I", "Ѕ": "S",
  "α": "a", "ε": "e", "ι": "i", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "ν": "v", "κ": "k", "χ": "x",
  "Α": "A", "Β": "B", "Ε": "E", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Χ": "X", "Υ": "Y",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "g");

export function foldConfusables(text: string): string {
  // Underscores glue words together for \b ("ignore_previous_instructions"); read them as spaces.
  return text.replace(CONFUSABLE_RE, (ch) => CONFUSABLES[ch] ?? ch).replace(/_/g, " ");
}

export interface InjectionRegion {
  field: AiReportField;
  start: number;
  end: number;
  kind: InjectionKind;
}

export interface InjectionScan {
  flagged: boolean;
  kinds: InjectionKind[];
  regions: InjectionRegion[];
}

/** SHA-256 hex digests look like encoded blobs only if longer; exclude pure-hex tokens (synthetic hashes are evidence). */
function isPlainHex(s: string): boolean {
  return /^[a-f0-9]+$/i.test(s);
}

export function scanForInjection(
  fields: Partial<Record<AiReportField, string>>,
  invisibleCharsRemoved = 0,
): InjectionScan {
  const regions: InjectionRegion[] = [];
  for (const [field, original] of Object.entries(fields) as Array<[AiReportField, string | undefined]>) {
    if (!original) continue;
    const text = foldConfusables(original);
    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        if (kind === "encoded_blob" && isPlainHex(m[0])) continue;
        const start = m.index ?? 0;
        // Widen to the whole line: the instruction usually continues past the trigger words.
        const lineStart = text.lastIndexOf("\n", start) + 1;
        const nl = text.indexOf("\n", start + m[0].length);
        regions.push({ field, start: lineStart, end: nl === -1 ? text.length : nl, kind });
      }
    }
  }
  const kinds = new Set(regions.map((r) => r.kind));
  if (invisibleCharsRemoved >= 3) kinds.add("invisible_characters");
  return { flagged: kinds.size > 0, kinds: [...kinds], regions };
}

export function overlapsRegion(
  regions: InjectionRegion[],
  field: AiReportField,
  start: number,
  end: number,
): boolean {
  return regions.some((r) => r.field === field && start < r.end && end > r.start);
}

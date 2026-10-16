/**
 * SOC-mode guards for the Handler (pure, no I/O). The input guard spots requests for verdicts,
 * answers, report grading or IOC lists (English and Hinglish) and answers them with a Socratic
 * redirect instead of calling a model. The output guard replaces any model reply that asserts a
 * verdict or confirms the learner's answer. Concept questions pass through both untouched.
 */

export type SocGuardCategory = "verdict_confirmation" | "report_verification" | "ioc_listing" | "answer_seeking" | "exam_pretend" | "rule_seeking";

const INPUT_RULES: Array<{ category: SocGuardCategory; re: RegExp }> = [
  // "is this a true positive?", "was alert A-12 a false positive", "tp or fp?"
  { category: "verdict_confirmation", re: /\b(is|was|isn'?t)\s+(this|it|that|alert\s+\S+|the\s+alert)\s+(really\s+|actually\s+)?(an?\s+)?(true|false|benign)[\s-]*(true[\s-]*)?positive/i },
  { category: "verdict_confirmation", re: /\b(tp|fp|btp)\s*(or|\/|vs\.?)\s*(tp|fp|btp)\b/i },
  { category: "verdict_confirmation", re: /\b(confirm|validate|check|verify)\s+(my|the|this)\s+(verdict|disposition|decision|triage|classification|severity|escalation)/i },
  { category: "verdict_confirmation", re: /\b(confirm|validate|check|verify)\s+(if|whether)\s+.*(malicious|benign|true[\s-]positive|false[\s-]positive)\b/i },
  // Only a bare "am I right?" (a concept check like "am I right that SPF breaks on forwarding?" passes).
  { category: "verdict_confirmation", re: /\b(am|was)\s+i\s+(right|correct|wrong)\s*\??\s*$/i },
  { category: "verdict_confirmation", re: /\b(is|was)\s+my\s+(verdict|disposition|decision|answer|triage|classification)\s+(right|correct|wrong|ok|okay|good|accurate)/i },
  { category: "verdict_confirmation", re: /\bshould\s+i\s+(escalate|close|dismiss)\s+(this|it|that|alert)\b/i },
  { category: "verdict_confirmation", re: /\b(is|was)\s+(this|it|that)\s+(malicious|benign|legit(imate)?|a\s+real\s+attack)\s*\??\s*$/i },
  // Hinglish: "kya ye true positive hai", "mera verdict sahi hai kya"
  { category: "verdict_confirmation", re: /\b(ye|yeh|ya|kya)\b.*\b(true|false|benign)\s*positive\b.*\b(hai|he|h|tha)\b/i },
  { category: "verdict_confirmation", re: /\b(verdict|decision|disposition|answer|jawab|triage)\b.*\b(sahi|galat|theek|thik)\b/i },
  { category: "report_verification", re: /\b(verify|check|grade|review|score|mark|rate|correct)\s+(my\s+|this\s+)?(incident\s+)?(report|handoff|answers?)\b/i },
  { category: "report_verification", re: /\b(report|handoff)\s+(check|verify|review)\s+(karo|kar|kardo|kar\s+do|kijiye)\b/i },
  { category: "ioc_listing", re: /\b(list|give|show|tell|dump|enumerate)\s+(me\s+)?(all\s+)?(the\s+)?(iocs?|indicators(\s+of\s+compromise)?|malicious\s+(ips?|domains?|hashes|urls?))\b/i },
  { category: "ioc_listing", re: /\b(iocs?|indicators)\b.*\b(bata|batao|batado|list\s+karo|de\s+do|do\s+na)\b/i },
  { category: "answer_seeking", re: /\b(what('?s|\s+is|\s+was)|tell\s+me|give\s+me|show\s+me|reveal|output|display|print)\s+(the\s+)?(correct\s+|right\s+|final\s+|expected\s+|ground\s+truth\s+|true\s+)?(answer|verdict|disposition|solution|ground\s+truth)\b/i },
  { category: "answer_seeking", re: /\b(dump|list|show|give|tell|reveal|print)\s+(me\s+)?(all\s+)?(the\s+)?(hold[\s-]*out(\s+test)?\s+(cases?|variants?|samples?)|hidden\s+(test\s+)?(cases?|variants?|alerts?|samples?)|ground\s+truth(\s+telemetry)?)\b/i },
  { category: "answer_seeking", re: /\bwhat\s+are\s+the\s+(hold[\s-]*out(\s+test)?\s+(cases?|variants?|samples?)|hidden\s+(test\s+)?(cases?|variants?|alerts?))\b/i },
  { category: "answer_seeking", re: /\b(answer|jawab|verdict|solution)\s+(bata|batao|batado|do|de\s+do)\b/i },
  { category: "exam_pretend", re: /\b(exam|test|assessment)\s+(is\s+|has\s+)?(over|ended|finished|done|khatam|khtm)\b/i },
  { category: "exam_pretend", re: /\b(pretend|imagine|assume)\b.*\b(exam|test|submitted|graded)\b/i },
  { category: "exam_pretend", re: /\b(ignore\s+(all\s+)?previous\s+instructions|system\s+override|debug\s+mode)\b/i },
  { category: "rule_seeking", re: /\b(write|give|generate|create|make|compose|draft)\s+(me\s+)?(a\s+|the\s+)?(detection\s+rule|sigma\s+rule|yara\s+rule|bladeql\s+rule|rule\s+query)\b/i },
  { category: "rule_seeking", re: /\bwhat\s+(rule|detection\s+rule|query|rule\s+query)\s+(should|can|do)\s+i\s+(write|use|submit)\b/i },
  { category: "rule_seeking", re: /\b(detection\s+rule|rule\s+query)\b.*\b(bana|banao|banado|likh|likho|de\s+do|do\s+na)\b/i },
];

export function classifySocRequest(message: string): SocGuardCategory | null {
  const m = message.normalize("NFKC").replace(/\s+/g, " ").trim();
  for (const r of INPUT_RULES) if (r.re.test(m)) return r.category;
  return null;
}

const HINGLISH_MARKERS = /\b(kya|hai|hain|batao|bata|karo|kaise|mera|meri|sahi|galat|nahi|samajh|kyun|ye|yeh|bhai)\b/i;
export const looksHinglish = (message: string) => (message.match(new RegExp(HINGLISH_MARKERS, "gi")) ?? []).length >= 2;

const REDIRECT_EN: Record<SocGuardCategory, string> = {
  verdict_confirmation:
    "I won't confirm or reject a verdict — that call is yours, and the debrief shows the answer after you submit. Let's test it instead: which two pieces of evidence most support your call, and what single finding would change your mind? Which log source could confirm or rule that out?",
  report_verification:
    "I can't grade or verify your report — it's scored after you submit. Check it against the method instead: does every claim point to evidence (a log line, a lookup, a time)? Is the timeline in order with times? Is there a clear next action and owner? Which section feels weakest to you?",
  ioc_listing:
    "I won't list this scenario's indicators — finding them is the skill being practised. Here's the method: start from the alert's own fields, pivot on each value (who else talked to it, when, from where), and keep only what the evidence ties to the activity. Which field will you pivot on first?",
  answer_seeking:
    "I can't give the answer, but I can help you get there. What does the evidence show so far, and what question are you trying to answer with your next search or lookup?",
  exam_pretend:
    "Nothing has changed: answers and verdicts are only revealed in your own debrief after submission. I'm happy to explain concepts or walk through method — what are you stuck on?",
  rule_seeking:
    "I won't write the detection rule for you — engineering the rule logic is the challenge being graded. Let's work through the design: which specific event fields (process, image, command line, network, registry) uniquely identify the attacker's behavior while ignoring legitimate administrative activity? What filter condition will separate the real intrusion from normal background operations?",
};

const REDIRECT_HI: Record<SocGuardCategory, string> = {
  verdict_confirmation:
    "Verdict main confirm ya reject nahi karunga — ye decision aapka hai, aur submit ke baad debrief mein answer dikhega. Chalo test karte hain: kaunse do evidence aapke call ko sabse zyada support karte hain, aur kaunsi ek finding aapka mind badal degi? Kaunsa log source use confirm ya rule out kar sakta hai?",
  report_verification:
    "Report ko main grade ya verify nahi kar sakta — submit ke baad score hota hai. Method se check karo: har claim kisi evidence (log line, lookup, time) se juda hai? Timeline times ke saath order mein hai? Clear next action aur owner hai? Kaunsa section sabse weak lagta hai?",
  ioc_listing:
    "Is scenario ke indicators main list nahi karunga — unhe dhoondhna hi practice hai. Method: alert ke apne fields se shuru karo, har value pe pivot karo (kisne usse baat ki, kab, kahan se), aur sirf wahi rakho jo evidence se juda ho. Pehle kis field pe pivot karoge?",
  answer_seeking:
    "Answer nahi de sakta, par wahan tak pahunchne mein help kar sakta hoon. Ab tak evidence kya dikhata hai, aur next search ya lookup se aap kaunsa sawal answer karna chahte ho?",
  exam_pretend:
    "Kuch nahi badla: answers aur verdicts sirf submission ke baad aapke debrief mein dikhte hain. Concepts ya method samjhane mein khushi se help karunga — kahan atke ho?",
  rule_seeking:
    "Detection rule main aapke liye nahi likhunga — rule design karna hi challenge ka part hai. Method se socho: kaunse specific event fields (process, image, command line, network) attacker ke behavior ko represent karte hain bina normal admin traffic ko trigger kiye? Kaunsi filter condition real attack ko benign activity se alag karegi?",
};

export function socRedirect(category: SocGuardCategory, message: string): string {
  return (looksHinglish(message) ? REDIRECT_HI : REDIRECT_EN)[category];
}

const OUTPUT_RULES: RegExp[] = [
  /\b(this|it|that|the\s+alert|alert\s+\S+)\s+(is|was|looks\s+like|seems\s+to\s+be|appears\s+to\s+be)\s+((definitely|clearly|likely|probably|indeed|actually)\s+)?(an?\s+)?(true|false|benign)[\s-]*(true[\s-]*)?positive/i,
  /\b(your|the)\s+(verdict|disposition|decision|answer|classification|triage|report)\s+(is|was|looks|seems)\s+((totally|completely|absolutely|exactly)\s+)?(correct|right|wrong|incorrect|accurate|spot[\s-]+on|perfect)/i,
  /\byou('re|\s+are|\s+were)\s+(correct|right|wrong)\s+(that|to\s+(mark|call|classify|close|escalate))/i,
  /\b(should|must)\s+be\s+(escalated|closed|dismissed|marked|classified)\s+as\s+(an?\s+)?(true|false|benign)/i,
  /\b(mark|close|classify)\s+(it|this|that)\s+as\s+(an?\s+)?(true|false|benign)[\s-]*(true[\s-]*)?positive/i,
  /\b(ye|yeh)\s+(ek\s+)?(true|false|benign)\s*positive\s+(hai|he|h)\b/i,
  /\b(aapka|tumhara|apka)\s+(verdict|decision|answer|report)\s+(sahi|galat|theek)/i,
  /\b(the\s+)?(correct|right|expected)\s+(answer|verdict|disposition)\s+(is|was|=)/i,
];

/** True when a model reply asserts a verdict or grades the learner's answer. */
export function socOutputLeaks(reply: string): boolean {
  const r = reply.normalize("NFKC").replace(/\s+/g, " ");
  return OUTPUT_RULES.some((re) => re.test(r));
}

import type { HandlerContext, LearnerCommand } from "./types";

export const SYSTEM_PROMPT_PROFESSOR_MODE = `You are "The Handler", an elite tactical operational mentor and cybersecurity instructor on the CyberBLADE platform.
You teach strictly in "Professor Mode" according to the CyberBLADE Teaching Style Guide:

### VOICE & PHILOSOPHY
- Clear, calm, logical, practical, direct, patient.
- Teach for understanding, not memorization.
- Teach so simply that the learner understands the concept on the first read. Make difficult concepts feel obvious.
- No academic fluff, no patronizing pep talks, no walls of jargon.

### THE 5-SECOND RULE
- Open every concept with "What is it?" in 1–2 extremely simple sentences.
- Simple explanation FIRST, technical definition AFTER.
- Never use jargon without translation. For example: "EDR — Endpoint Detection and Response. In simple terms, EDR is software that watches what happens on computers and detects suspicious activity."

### ANALOGIES (USE THEM OFTEN)
- IP address = house address
- Port = numbered door
- Firewall = security guard checking who can enter or leave
- DNS = phonebook matching names to numbers
- IAM = corporate security desk issuing badges and checking clearance
- SIEM = central security control room watching all building monitors and alarms

### LEARNER COMMANDS
When the learner issues these commands, adapt your structure precisely:
- "what is X?": What is it → Why it exists → How it works → Example → Cybersecurity relevance → Remember it like this.
- "why?": Simple cause-and-effect first, then the technical reason.
- "explain again": Provide a completely different analogy, example, or angle. Never repeat verbatim.
- "simplify": Even easier, as if explaining to a beginner seeing it for the very first time. Minimal jargon.
- "deep dive": More technical depth, internal packet/OS mechanisms, keeping language lucid and direct.
- "example": Everyday analogy + technical command + security attack/defense context.
- "diagram": Clean ASCII diagram with every component labeled and explained.
- "test": 5 short questions (MCQ + conceptual + scenario). Grade only after the learner responds.
- "interview": Ask one sharp security interview question, wait for answer, evaluate like a hiring manager.
- "revision": Ultra-concise What → Why → How → Security relevance.
- "recap": Connect current concept into an end-to-end chain with previous fundamentals.
- "hint": Give a graduated Socratic clue (Nudge or Direction) based on the lab hint ladder.

### STRICT OPERATIONAL CONSTRAINTS (ANTI-CHEAT)
1. NEVER reveal raw flags (e.g. strings matching FLAG{...} or cryptographic hashes).
2. NEVER give the direct exact answer string to a lab objective. Teach the METHODOLOGY so the learner extracts the answer themselves.
3. NEVER execute commands on behalf of the learner.
4. If in a timed rank challenge, transmission is blocked: inform the learner that during challenges, operators must rely entirely on their own methodology without Handler assistance.
5. Refuse real-world offensive targeting requests outside the platform sandbox. Keep all instruction defensive, educational, and authorized.`;

export function detectCommand(text: string): LearnerCommand {
  const clean = text.trim().toLowerCase();
  if (/^what\s+is\b/i.test(clean) || /^what'?s\b/i.test(clean)) return "what_is";
  if (/^why\b/i.test(clean) || clean === "why?" || clean === "why") return "why";
  if (/explain\s+again/i.test(clean) || /explain\s+it\s+again/i.test(clean)) return "explain_again";
  if (/^simplify\b/i.test(clean) || /make\s+it\s+simpler/i.test(clean) || /easier/i.test(clean)) return "simplify";
  if (/deep\s*dive/i.test(clean) || /technical\s+details/i.test(clean)) return "deep_dive";
  if (/example\b/i.test(clean)) return "example";
  if (/diagram\b/i.test(clean) || /ascii/i.test(clean) || /draw\b/i.test(clean)) return "diagram";
  if (/^test\b/i.test(clean) || /quiz\b/i.test(clean) || /test\s+me/i.test(clean)) return "test";
  if (/^interview\b/i.test(clean) || /mock\s+interview/i.test(clean)) return "interview";
  if (/revision\b/i.test(clean) || /review\b/i.test(clean)) return "revision";
  if (/^recap\b/i.test(clean) || /connect\b/i.test(clean)) return "recap";
  if (/hint\b/i.test(clean) || /clue\b/i.test(clean) || /help\s+me\s+with\s+objective/i.test(clean)) return "hint";
  return "custom";
}

export function buildSystemPrompt(context: HandlerContext): string {
  let prompt = SYSTEM_PROMPT_PROFESSOR_MODE;

  if (context.isChallenge) {
    prompt += `\n\n### CRITICAL STATUS: CHALLENGE MODE ENGAGED
This is a timed Rank Challenge or Exam.
You are strictly ordered by platform rules to operate in SILENT MODE.
Inform the operator that Handler comms are severed during active clearance challenges to ensure untainted evaluation.
Do NOT provide hints, answers, or methodology for current objectives.`;
    return prompt;
  }

  if (context.kind === "lesson") {
    prompt += `\n\n### CURRENT LESSON CONTEXT
Lesson ID: ${context.lessonId ?? "unknown"}
Title: ${context.lessonTitle ?? "Core Lesson"}
Module: ${context.module ?? "Fundamentals"}
Rank Level: ${context.rank ?? 0}`;
    if (context.lessonExcerpt) {
      prompt += `\nLesson Briefing / Excerpt:\n"""\n${context.lessonExcerpt.slice(0, 3000)}\n"""`;
    }
  } else if (context.kind === "lab") {
    prompt += `\n\n### CURRENT LAB CONTEXT
Lab ID: ${context.labId ?? "unknown"}
Lab Title: ${context.labTitle ?? "Hands-on Lab"}`;

    if (context.objectives && context.objectives.length > 0) {
      prompt += `\nObjectives:`;
      for (const obj of context.objectives) {
        prompt += `\n- [${obj.id}] ${obj.prompt} (${obj.solved ? "SOLVED" : "UNSOLVED"})`;
      }
    }

    if (context.hints && Object.keys(context.hints).length > 0) {
      prompt += `\n\nAuthorized Hint Ladder (for graduated hints, do not reveal all at once):`;
      for (const [objId, hints] of Object.entries(context.hints)) {
        prompt += `\nObjective ${objId}:`;
        hints.forEach((h, idx) => {
          prompt += `\n  Tier ${idx + 1}: ${h}`;
        });
      }
    }

    if (context.recentCommands && context.recentCommands.length > 0) {
      prompt += `\n\nRecent Terminal Commands Executed by Learner:\n${context.recentCommands.slice(-8).map((c) => `$ ${c}`).join("\n")}`;
    }
  }

  return prompt;
}

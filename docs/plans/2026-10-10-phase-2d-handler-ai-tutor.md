# Phase 2D — The Handler: Socratic AI Tutor Implementation Plan

**Branch:** `phase-2d-handler-ai-tutor`  
**Dependencies:** Phase 2A (Networking), Phase 2B (Linux), Phase 2C (Windows & Capstone) merged on `main`  
**Date:** 2026-10-10  
**Status:** In Progress

---

## 1. Overview & Objectives

Phase 2D builds **The Handler**, CyberBLADE's signature in-platform Socratic AI tutor. Rather than giving away answers or acting as an generic chatbot, The Handler acts as a senior operational mentor adhering strictly to the platform's **Teaching Style Guide ("Professor Mode")** (`docs/curriculum/teaching-style.md`) and platform specifications (`docs/specs/2026-10-06-platform-design.md` §8).

### Core Pillars
1. **Professor Mode Teaching Style:**
   - 5-second rule: What is it in 1–2 simple sentences first!
   - Simple explanation first, technical definition after.
   - Zero jargon without translation.
   - Real-world cybersecurity analogies (IP = house address, port = numbered door, firewall = security guard, DNS = phonebook, IAM = security desk, SIEM = control room).
   - Dedicated responses to core learner commands: `what is X?`, `why?`, `explain again`, `simplify`, `deep dive`, `example`, `diagram`, `test`, `interview`, `revision`, `recap`.
2. **Three-Tier Progressive Hint Disclosure:**
   - Leverages the `hints` ladder declared in `lab.yaml`.
   - **Tier 1 (Nudge):** Concept reminder and relevant tool syntax.
   - **Tier 2 (Direction):** Specific file path, log channel, or registry hive to inspect with recommended flags.
   - **Tier 3 (Walkthrough):** Step-by-step investigation methodology.
   - Updates `hintsUsed` on the learner's lab attempt.
3. **Strict Anti-Cheat & Security Policy:**
   - Never reveals raw flags (e.g., `FLAG{...}` or regex matches).
   - Never directly yields the exact objective answer string.
   - Never executes commands on behalf of the user.
   - Strictly refuses off-platform offensive requests or unauthorized targets.
   - **Challenge/Exam Lockout:** During timed rank challenges (`/challenge/[rank]`), Handler transmission is severed: `[COMM LINK SEVERED] Handler is offline during rank challenges. Work it out as an operator must.`
4. **Multi-Model Provider Architecture:**
   - Server-side only (API keys never sent to the browser).
   - **Groq Provider:** Ultra-low latency inference (`llama-3.3-70b-versatile` / `GROQ_API_KEY`).
   - **Gemini Provider:** Deep diagnostic feedback (`gemini-1.5-flash` / `GEMINI_API_KEY`).
   - **Heuristic Offline Engine:** Guaranteed local/test fallback generating authentic Professor Mode responses and lab hints when no API keys are present.
5. **Tactical UI / UX:**
   - Tactical cyberpunk drawer with blade styling, scanline accents, and collapsible drawer.
   - Fast command quick-chips (`[what is this?]`, `[why?]`, `[simplify]`, `[diagram]`, `[request hint]`).
   - Markdown, code syntax, and ASCII diagram rendering.

---

## 2. Technical Architecture & File Layout

### 2.1 Engine (`lib/handler/`)
- `types.ts`:
  - `HandlerMessage`, `HandlerRole`, `HandlerContext`, `HandlerResponse`, `LearnerCommand`.
- `prompts.ts`:
  - System prompt incorporating all Professor Mode rules and anti-cheat constraints.
  - Template builders for lesson context and lab context.
- `hints.ts`:
  - Progressive hint engine reading `lab.hints` and tracking attempt progress.
- `guardrails.ts`:
  - Output sanitization to detect and block flag leakage or answer disclosures.
- `providers/`:
  - `types.ts`: `HandlerProvider` interface.
  - `groq.ts`: Groq REST integration with temperature and token limits.
  - `gemini.ts`: Google Gemini REST integration.
  - `heuristic.ts`: Rule & knowledge-based fallback engine for local/offline execution.
  - `factory.ts`: Dynamic provider resolver with graceful fallback chain (`Groq -> Gemini -> Heuristic`).
- `service.ts`:
  - Main coordinator: `askHandler(ctx, input)` and `getLabHint(ctx, input)`.

### 2.2 Server Actions (`app/(app)/handler/actions.ts`)
- `askHandlerAction(input)`:
  - Validates operator session.
  - Validates lesson/lab context against server storage.
  - Invokes `service.askHandler`.
- `requestLabHintAction(attemptId, objectiveId)`:
  - Advances hint tier and records `hintsUsed` on `LabAttempt`.

### 2.3 UI Components (`components/handler/`)
- `HandlerDrawer.tsx`: Slide-out cyberpunk communicator drawer.
- `HandlerMessageView.tsx`: Displays chat messages with avatars, timestamps, and formatted ASCII/markdown.
- `HandlerChips.tsx`: Quick-action command buttons.
- `HandlerTrigger.tsx`: Floating/header tactical HUD button.

### 2.4 Integration Points
- `app/(app)/learn/[lessonId]/page.tsx`: Embedded Handler with lesson context.
- `components/labs/LabWorkspace.tsx`: Embedded Handler with lab env and objective context.
- `app/(app)/challenge/[rank]/page.tsx`: Shows challenge mode lockout state.

---

## 3. Verification & Quality Gates

1. **Unit & Integration Tests (`tests/unit/lib/handler/`)**:
   - Provider factory tests (Groq, Gemini, Heuristic fallback).
   - Command parser & responder tests (`what is`, `why`, `simplify`, `diagram`, `test`, `recap`).
   - Progressive hint ladder disclosure (Tier 1 -> Tier 2 -> Tier 3).
   - Anti-cheat sanitization (flag blocking, raw answer masking).
   - Challenge lockout verification.
2. **Quality Gates**:
   - `npm run lint` (0 errors).
   - `npm run typecheck` (0 errors).
   - `npm run check:content` (0 errors).
   - `npm test` (all tests passing).
   - `npm run build` (Next.js production build passing).
3. **Playwright E2E Tests (`tests/e2e/handler.spec.ts`)**:
   - Learner opens Handler drawer on a lesson and asks a question.
   - Learner clicks a command chip (`[what is this?]` or `[simplify]`) and receives an instant answer.
   - Learner in a lab requests a hint and receives progressive tiers.
   - Learner in a rank challenge sees the offline lockout indicator.

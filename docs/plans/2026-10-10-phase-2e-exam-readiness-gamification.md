# Phase 2E — Exam Readiness Engine & Gamification Implementation Plan

**Branch:** `phase-2e-exam-readiness-gamification`  
**Dependencies:** Phase 2A, 2B, 2C, 2D merged on `main`  
**Date:** 2026-10-10  
**Status:** In Progress

---

## 1. Overview & Objectives

Phase 2E delivers the **Exam Readiness Engine** and the **Tactical Gamification Subsystems** (Streaks, Activity Heatmap & Badges Wall) specified in `docs/specs/2026-10-06-platform-design.md` §5.5, §9 and `docs/curriculum/cert-targets.md`.

### Core Goals
1. **Exam Readiness Engine:**
   - Parse certification targets and objectives matrix from `content/coverage/core.yaml`.
   - Calculate objective coverage and mastery scores across:
     - CompTIA Network+ (`netplus` / N10-009)
     - CompTIA Security+ (`secplus` / SY0-701)
     - CompTIA Linux+ (`linuxplus` / XK0-006)
     - CompTIA A+ Core 1 (`aplus1201` / 220-1201)
     - CompTIA A+ Core 2 (`aplus1202` / 220-1202)
     - ISC2 Certified in Cybersecurity (`isc2cc` / CC)
   - Assign grading bands according to `docs/curriculum/teaching-style.md`:
     - 0–49%: `Weak`
     - 50–69%: `Needs review`
     - 70–84%: `Good`
     - 85–94%: `Strong`
     - 95–100%: `Exam Ready`
   - Detailed breakdown showing which objectives are cleared vs remaining.
2. **Habit Loops & Daily Operational Streaks:**
   - Compute consecutive active days from operator activity timestamps (XP events, lessons completed, lab attempts).
   - Display a 7-day activity telemetry readout and active streak counter.
3. **Tactical Badges & Achievement Showcase:**
   - Evaluated dynamically against operator progress:
     - `INITIATE`: Enrolled at Rank 0.
     - `OPERATOR`: Clearance elevated to Rank 1.
     - `WATCHER`: Clearance elevated to Rank 2.
     - `PACKET_SURGEON`: Solved packet inspection labs.
     - `ROOT_HUNTER`: Audited Linux permissions and SUID backdoors.
     - `POWERSHELL_WARDEN`: Triaged Windows registry run keys and security event logs.
     - `IRON_GATE_SURVIVOR`: Completed the Rank 1 Capstone Challenge.
     - `FIRST_BLOOD`: Solved first practical lab or lesson check.
     - `CLEAN_RUN`: Solved a lab without requesting hints.
     - `TACTICAL_STREAK`: Maintained a 3-day operational streak.
     - `DISCIPLINE_MASTER`: Maintained a 7-day operational streak.
4. **Dashboard Integration:**
   - Embed Cert Readiness Scorecards, Streak Telemetry HUD, and Badges Wall into `/dashboard`.

---

## 2. Technical Architecture & File Layout

### 2.1 Progress Repository Extensions
- `lib/progress/repo.ts`:
  - Add `listXpEvents(userId: string): Promise<XpEvent[]>`
  - Add `listAttempts(userId: string): Promise<LabAttempt[]>`

### 2.2 Exam Readiness Engine (`lib/readiness/`)
- `types.ts`: Cert definitions, objective readiness, and score calculation types.
- `calculator.ts`: Evaluates completed lessons and labs against certification objectives.

### 2.3 Gamification Engine (`lib/gamification/`)
- `streaks.ts`: Calculates current streak, longest streak, and weekly activity array from dates.
- `badges.ts`: Defines badge metadata and evaluator function.

### 2.4 UI Components (`components/dashboard/`)
- `CertReadinessSection.tsx`: Tactical cards with progress bars and grade bands for each cert.
- `StreakWidget.tsx`: Flame/node streak indicator for past 7 days.
- `BadgesWall.tsx`: Cyberpunk achievement grid showing unlocked vs locked badges.

### 2.5 Verification
- Unit tests:
  - `tests/unit/lib/readiness/calculator.test.ts`
  - `tests/unit/lib/gamification/streaks.test.ts`
  - `tests/unit/lib/gamification/badges.test.ts`
- Playwright E2E test:
  - `tests/e2e/exam-readiness-gamification.spec.ts`
- Automated quality gates: `check:content`, `lint`, `typecheck`, `test`, `build`.

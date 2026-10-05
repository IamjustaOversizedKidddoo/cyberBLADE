# CLAUDE.md — Cybersecurity Learning Platform (codename NEON)

Read `docs/specs/2026-10-06-platform-design.md` before doing any work. It is the source of truth.

## What we're building
A text-first, hacker-themed platform that takes anyone (tech or non-tech, starting from zero) to a job-ready cybersecurity professional. Shared core (Ranks 0–2) → job tracks (launch: SOC Analyst, Penetration Tester, Cloud Security). No videos, no live mentors: text lessons + browser labs + AI tutor ("the Handler") + practical exams.

## How we work
- Work phase by phase (spec §14). For each phase: write an implementation plan in `docs/plans/` (use the superpowers `writing-plans` skill), get owner approval, then build.
- Test-driven for code in `lib/` (lab engine, generators, checks, progress). Every lab must have a test that solves it.
- Small, focused files. One lab type per folder in `lib/lab-engine/`.
- Never commit secrets. Claude API and Razorpay keys live in env vars, used server-side only.

## Stack
Next.js (App Router) + TypeScript · Tailwind · MDX content in `content/` · Supabase (Postgres + Auth) · Claude API (server routes) · Razorpay · Vitest + Playwright · Vercel.

## Theme rules
- Visual direction (owner decision 2026-10-06): the look of https://watchdogsfont.com — black pages, white text, near-white hero bands with huge black glitch type, cyan `#0FBEFF` / purple `#C83CFF` / hot-pink `#FF1065` accents, blinking `_` cursors, typewriter text, snake_case headings (`rank_0`), terminal panels, subtle scanlines.
- Fonts: **Hacked** (David Libeau, CC-BY — credit required on /credits and in the footer) for display headings and the wordmark; **Pixel Operator** for subheadings, buttons, labels. Long-form lesson prose stays in a readable sans and terminals/code in a monospace — glitch/pixel fonts are never used for body text.
- Still NEVER use Ubisoft's actual logos, the DedSec symbol, game artwork, screenshots, character names, or the "Watch Dogs" name anywhere in the product. Style yes, their assets no. (Owner accepts the trade-dress risk of the look.)
- Effects must never block reading; support `prefers-reduced-motion`; lessons must be readable on mobile.

## Content standard (non-negotiable)
Goal: deeper and more practical than CEH, CompTIA Security+/CySA+, and OSCP prep material.

- **Original only.** Map to official cert *objectives* (`content/coverage/<track>.yaml`), never copy vendor text or questions.
- Every technical claim must be accurate and checkable. Every command/query shown must work in the lab engine or a real environment.
- Write for a smart beginner with zero background: analogy first, then full technical depth. Define every term on first use.
- Mark each lesson `status: draft` until a human expert reviews it. Never publish AI drafts unreviewed.
- Offensive lessons include legal/authorization context.

### Lesson template (every lesson follows this)

```mdx
---
id: core-r1-net-dns-01
title: "DNS — The Internet's Phonebook"
track: core            # core | soc | pentest | cloud
rank: 1
module: networking
order: 7
estimated_minutes: 30
objectives_covered: ["secplus:x.y", "netplus:x.y"]   # from coverage matrix
mitre: []              # ATT&CK IDs where relevant
lab: core-dns-lab-01   # optional
xp: 100
status: draft          # draft | reviewed | published
last_reviewed: null
---

## Briefing
### 1. What it is            <!-- plain language + everyday analogy -->
### 2. Why it exists          <!-- the problem it solves -->
### 3. How it works           <!-- internals step by step, diagrams, real examples -->
### 4. How attackers abuse it <!-- techniques + ATT&CK IDs -->
### 5. How defenders detect it<!-- what it looks like in logs/SIEM, example queries -->
### 6. How to prevent/fix it  <!-- hardening, controls -->

## Terminal Check
<!-- 2–4 questions: recall + application. Explanations for every answer option. -->

## Lab
<!-- link/embed lab + what the learner will do -->

## Debrief
<!-- what a pro does here, common mistakes, a real public incident where this mattered, key takeaways -->
```

### Lab definition
See spec §7.2 (`labs/<lab-id>/lab.yaml`). Datasets come from seeded generators so every learner and exam candidate gets unique values. Answer keys are never sent to the client in plain text.

## Handler (AI tutor) rules
- Graduated hints from the lab hint ladder; never reveal flags or exam answers.
- Disabled in exam mode.
- Scope-limited to platform learning; refuses real-world offensive targeting.
- Cheap model for hints/Q&A, stronger model for report grading; per-user daily limits.

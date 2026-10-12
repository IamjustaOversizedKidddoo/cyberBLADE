# Phase 3 SOC Workspace: Engineering Assumptions & Default Decisions

**Document:** `docs/specs/soc-workspace-assumptions.md`  
**Status:** Living Engineering Record  
**Date:** 2026-10-12  
**Author:** Staff Engineer & SOC Specialist  
**Companion Docs:** `docs/specs/phase-3-soc-track.md`, `docs/design/soc-workspace.md`

---

## 1. Overview

Where `docs/specs/phase-3-soc-track.md` or earlier platform design specifications were silent, ambiguous, or left engineering decisions open, the SOC Workspace implementation adopts the following explicit architectural defaults.

---

## 2. Table of Assumptions & Rationale

| # | Domain | Assumption / Decision | Rationale & Trade-offs |
|:---|:---|:---|:---|
| **A1** | **Disposition Taxonomy** | Standard 5-tier taxonomy: `true_positive`, `false_positive`, `benign_true_positive`, `duplicate`, `needs_more_info`. | Reflects modern MSSP & Tier-1 SOC operational standards. `benign_true_positive` captures authorized activity (scans, administrative scripts) without calling it a false detection. Configurable via `content/soc/taxonomy.yaml`. |
| **A2** | **Decision Log Immutability** | Decisions are stored as an append-only log in `soc_decisions`. Revisions append a new record; the latest record represents the active state. | Preserves the learner's complete diagnostic thought process for learning analytics and anti-cheat audit trails, while giving the learner full freedom to correct their work before submission. |
| **A3** | **Evaluator Scoring Weights** | Default provisional weights: Alert Disposition (40%), Assessed Severity (15%), Escalation Decision (20%), Case Grouping (15%), Written Rationale presence & length (10%). | Balances triage accuracy with investigative reasoning. Documented as provisional until calibrated against learner cohorts. |
| **A4** | **Acceptable Alternatives** | Scenario ground truth may specify `acceptableAlternatives` for ambiguous alerts with full or partial credit. | In real SOCs, alerts are frequently ambiguous without deep packet or disk captures. Penalizing reasonable analyst interpretations creates frustration. |
| **A5** | **Debrief Disclosure Policy** | Upon submission, explanatory debriefs are returned **only for alerts the learner triaged**. Untriaged alerts display only whether they were missed incidents or ignored noise, but do NOT reveal root-cause narratives. | Prevents answer harvesting where a learner triages 1 alert, submits immediately, and views the entire scenario answer key. |
| **A6** | **Case Association Model** | An alert can belong to at most one case per attempt. Cases own alerts via `soc_case_alerts`. | Simplifies Tier-1 mental model and UI state while matching standard ticketing workflows (an alert is attached to a single incident ticket). |
| **A7** | **Instant Feedback Default** | `instantFeedback` flag defaults to `false`. When enabled (training mode), feedback is generic and non-revealing. | Immediate answer feedback turns realistic triage into trial-and-error guessing. |
| **A8** | **Synthetic Telemetry Ranges** | All IP addresses strictly utilize RFC 5737 documentation blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). Domains use `.corp.internal`, `.test`, or `.example`. | Zero risk of scanning, resolving, or leaking real-world enterprise infrastructure or branding. |
| **A9** | **XP Gating & Ranks** | The demo SOC scenario is gated at Rank 2 (Watcher) completion, awarding 150 XP upon first successful submission. | Ensures prerequisite knowledge (Windows/Linux logging, networking) is verified before learners enter the alert queue. |
| **A10** | **Rate Limiting Defaults** | Decision saves are throttled to 30 requests per minute per user. Submissions are limited to 5 per hour. | Prevents script-driven fuzzing while providing ample headroom for human analyst operations. |
| **A11** | **Virtualization Boundary** | Alert queue virtualization triggers when alert count exceeds 25 rows, maintaining 60 FPS performance on 500+ alerts. | Ensures snappy rendering regardless of scenario size, especially on lower-powered devices. |
| **A12** | **Storage Dual-Mode** | Hosted mode uses Supabase Postgres with RLS; local dev/offline mode uses atomic JSON store in `.data/progress.json`. | Full local-first compatibility consistent with platform architectural conventions. |

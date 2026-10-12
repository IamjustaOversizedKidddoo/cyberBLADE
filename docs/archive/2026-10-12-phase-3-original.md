# Archived: Original Phase 3 — SOC Track (Pre-Redesign)

**Archived:** 2026-10-12
**Reason:** Phase 3 redesigned around SOC certification outcomes (SAL1, SAL2, BTL1, CDSA, CySA+). See `docs/specs/phase-3-soc-track.md` for the replacement.

---

## Original Phase 3 from `docs/specs/2026-10-06-platform-design.md` §14

> | **3. SOC track** (wk 11–16) | First job track | Full SIEM console, `report` lab + AI grading, SOC content, SOC exam, certificate + verify page, coverage matrix | Beta testers pass the SOC exam; external reviewer sign-off |

## Original SOC Analyst Roadmap (`docs/curriculum/soc-analyst-roadmap.md`)

The full original roadmap remains at `docs/curriculum/soc-analyst-roadmap.md` (unchanged).

Key features of the original plan:
- 14 modules, ~16 weeks
- Designed around "notice, investigate, decide and report" loop
- Benchmarked against: Security+, CySA+, BTL1, Splunk Core User, GCIH-level topics
- Four portfolio deliverables: SIEM notebook, phishing report, detection rule pack, full incident report
- Track exam: 8-hour simulated SOC shift with 60+ alerts and 3 hidden incidents

## Why It Was Archived

The original plan was sound directionally but lacked:
1. Explicit certification outcome targeting beyond "objective coverage"
2. Exam-format practice matching each target cert's actual format
3. A SOC simulator with realistic alert-queue triage (beyond the SIEM query console)
4. Scenario variant generation at scale
5. Report grading with practitioner calibration
6. A readiness gate calibrated against real exam outcomes
7. Specific coverage of newer certs: TryHackMe SAL1/SAL2, HTB CDSA

The redesigned Phase 3 keeps the same 14-module structure as a foundation but wraps it in a certification-outcome framework with measurable "better than typical" claims.

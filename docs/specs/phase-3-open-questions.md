# Phase 3: Open Questions, Manual Verifications & Owner Decisions

**Status:** Decisions, manual verification tasks, and recruitment plan for Phase 3  
**Date:** 2026-10-12  
**Author:** Curriculum Architect & SOC Specialist  
**Companion Docs:** `docs/specs/phase-3-soc-track.md` (Design Spec), `docs/specs/phase-3-benchmark.md` (Benchmark & Gap Audit)

---

## Executive Summary

This document captures all items that **cannot be resolved autonomously by an agent** and require explicit owner decisions, human verification against vendor portals, or human recruitment before or during Phase 3 implementation.

---

## 1. Decisions Only the Owner Can Make

| # | Decision Topic | Options | Trade-offs & Recommendation | Owner Choice |
|:---|:---|:---|:---|:---:|
| **D1** | **Scope of Levels for Initial Paid Launch** | **Option A (Recommended):** Ship Slice 1 (L1 Core, Modules 1–8, MVP simulator, 3 scenario families, SAL1-format mock) as the initial paid launch product (Phase 4). Ship L2 (Modules 9–14) as a major roadmap update.<br>**Option B:** Wait until both L1 and L2 are complete before launching paid tier. | **Recommendation: Option A.** Option A generates revenue ~10 weeks earlier, validates simulator and grading mechanics with paying users, and limits initial surface area. Waiting for L2 delays launch by 60–80 agent-days. | `[ Pending Owner Decision ]` |
| **D2** | **SOC Level 3 (L3) Scope** | **Option A (Recommended):** Formally drop L3 from Phase 3 scope. Revisit only if vendor launches verified SAL3 or employer demand emerges.<br>**Option B:** Define an advanced Tier 3 / Lead Analyst curriculum now. | **Recommendation: Option A.** Web research confirms **SAL3 does not exist** as of October 2026. Defining an ungrounded L3 leads to scope creep and distracts from core L1/L2 exam alignment. | `[ Pending Owner Decision ]` |
| **D3** | **Real-Tool Container Labs vs. Browser Simulator** | **Option A (Recommended):** Stick to high-fidelity browser simulator + downloadable "Build-Your-Own-Lab" guides (Docker/local VM setups) for Phase 3. Defer managed cloud containers (Elastic/Wazuh) to Phase 3.5 or Phase 8.<br>**Option B:** Build per-session container infrastructure now. | **Recommendation: Option A.** Container isolation (gVisor/Firecracker), anti-cryptomining, session teardown, and egress controls require dedicated platform engineering and carry high ongoing compute costs (~$0.10–$0.50/hr). Browser simulator gives 80% fidelity with $0 marginal infra cost. | `[ Pending Owner Decision ]` |
| **D4** | **AI Report Grader Autonomy & Gate** | **Option A (Recommended):** Hard gate at Cohen's $\kappa \ge 0.70$ inter-rater agreement against 3 human practitioners across 50 reports. Prior to hitting $\kappa \ge 0.70$, AI gives only qualitative coaching/critique, with NO numerical grade displayed.<br>**Option B:** Display estimated AI grades immediately with a disclaimer. | **Recommendation: Option A.** Hallucinated or inaccurate numerical scores will destroy learner trust and invalidate the readiness gate. Qualitative rubric feedback is safe and educational; numerical scores must be validated. | `[ Pending Owner Decision ]` |
| **D5** | **Pricing Model & Free-Tier Boundary** | **Option A (Recommended):** Free Tier: Modules 1–3 + 3 practice scenarios. Pro Tier (₹499/mo or ₹3,999/yr): Modules 4–14, all scenario variants, full mock exams, AI report grading (5/day cap). Exam Attempt Fee: ₹2,999.<br>**Option B:** Make all content free; charge only for certification exam & grading.<br>**Option C:** Fully paid track with 7-day trial. | **Recommendation: Option A.** Fits existing platform design (§12). Modules 1–3 provide strong hook and proof of quality while protecting proprietary scenario engines. | `[ Pending Owner Decision ]` |
| **D6** | **Credential Branding & Verification Policy** | **Option A (Recommended):** CyberBLADE issues "Certified SOC Analyst - Level 1 (CBSA-L1)" completion credential with public `/verify/[id]` page, verifiable scenario proof pack, and explicit non-affiliation disclaimer.<br>**Option B:** No internal credential; market platform solely as an exam prep engine for third-party certs. | **Recommendation: Option A.** Learners value shareable credentials on LinkedIn. As long as disclaimers are unambiguous and reports can be showcased in portfolios, CBSA-L1 provides tangible motivation. | `[ Pending Owner Decision ]` |

---

## 2. Facts to Verify Manually (Paywalled / Non-Public Data)

The following facts could not be confirmed with 100% certainty via public documentation during research on 2026-10-12 and are marked **UNVERIFIED** in the benchmark. The owner or a designated team member with portal access must verify these items:

| # | Certification | Data Point | Current Assumption | How & Where to Check | Verified Value |
|:---|:---|:---|:---|:---|:---:|
| **F1** | **TryHackMe SAL1** | Passing score threshold | Estimated 70% | Check TryHackMe SAL1 exam instructions / candidate agreement inside a subscribed THM account. | `[ ]` |
| **F2** | **TryHackMe SAL1** | Report grading workflow | Hybrid (automated checks + human review) | Check candidate FAQ or contact THM support. Confirm whether human graders evaluate every report or if an automated rubric handles passing grades. | `[ ]` |
| **F3** | **TryHackMe SAL1** | Credential validity period | 3 years or non-expiring | Check issued SAL1 certificate metadata on Accredible or Badgr. | `[ ]` |
| **F4** | **TryHackMe SAL2** | Passing score threshold | Estimated 70% | Check THM SAL2 exam terms and conditions upon voucher redemption. | `[ ]` |
| **F5** | **TryHackMe SAL2** | Report grading workflow | Human staff review | Verify whether SAL2 reports are manually reviewed by THM staff and expected turnaround time. | `[ ]` |
| **F6** | **Security Blue Team BTL1** | Recertification / Expiry | Non-expiring (lifetime) | Check SBT candidate portal FAQ: verify if BTL1 requires CPEs or expires after 3 years. | `[ ]` |
| **F7** | **HTB CDSA** | Exact report scoring rubric | Weighted rubric (flags + report) | Review HTB Academy CDSA Candidate Handbook regarding report weight vs. flag submission. | `[ ]` |
| **F8** | **HTB CDSA** | Credential validity period | Non-expiring or 3 years | Check HTB Academy certification policy page. | `[ ]` |
| **F9** | **CompTIA CySA+** | CS0-003 retirement status | CS0-004 is active; CS0-003 sunsetting | Verify exact English-language retirement date of CS0-003 on CompTIA's retirement calendar to ensure all prep aligns 100% to CS0-004. | `[ ]` |

---

## 3. People to Recruit: Practitioner Review Program

The practitioner review program is the **single biggest credibility requirement** for the SOC track. Without working analysts validating scenarios, CyberBLADE risks shipping toy problems.

### 3.1 Reviewer Personas & Headcount Targets

| Persona | Target Count | Required Background | Primary Responsibility |
|:---|:---:|:---|:---|
| **Tier 1 / Tier 2 SOC Analyst (Indian MSSP/Enterprise)** | 4–6 | 1–3 years active SOC experience at MSSP (e.g., Wipro, Infosys, Tata Communications, CyberProof, Paladion) | Review alert queue noise realism, triage workflow, false-positive distributions, and ticket note rubrics. |
| **Senior SOC / Incident Responder (Global/Remote)** | 2–3 | 4+ years handling live intrusions, holding BTL1/BTL2, CDSA, or SANS GCIH/GCFA | Review attack-chain realism, MITRE ATT&CK alignment, and scenario ground truth. Grade sample reports for $\kappa$ calibration. |
| **Certification Completers (Beta Cohort)** | 5–10 | Learners who passed SAL1, BTL1, CDSA, or CySA+ within the last 6 months | Compare CyberBLADE mock exam format/difficulty against their actual exam experience. |

### 3.2 Recruitment Channels

1. **LinkedIn Outreach:** Targeted searches for "SOC Analyst", "Security Operations Center", "Incident Responder" in Bangalore, Hyderabad, Pune, NCR.
2. **Indian InfoSec Communities:** Post in Null community channels, Garage48, c0c0n community groups, and BSides India forums.
3. **Subreddits & Discord:** Posts in `r/SecurityBlueTeam`, `r/cybersecurity`, and TryHackMe/HTB community Discord channels seeking reviewers for educational scenarios.

### 3.3 Compensation & Attribution Structure

- **Financial:** ₹3,000–₹5,000 per verified scenario review pack (including attack chain validation and 5 report test gradings) or $60–$100 for international practitioners.
- **Platform Access:** Free lifetime Pro access to CyberBLADE for all active contributors.
- **Public Attribution (Optional with consent):** "Technical review and scenario validation provided by [Name], [Title] at [Company/Independent]."

---

## 4. Potential Blockers & Mitigation

| Blocker | Severity | Trigger / Condition | Impact | Pre-Emptive Mitigation |
|:---|:---:|:---|:---|:---|
| **Failure to recruit 3+ practitioners before Scenario authoring** | High | Zero sign-ups 3 weeks into Phase 3 Slice 1 | Scenarios may lack enterprise noise authenticity; grading calibration stalled | Tap personal/founder network; increase cash stipend; begin outreach in parallel with SIEM engine dev. |
| **LLM Report Grader inter-rater agreement below $\kappa < 0.70$** | High | Grader produces divergent marks on trial batch of 50 reports | Cannot show numerical grades to learners without misleading them | Fall back to hybrid design: deterministic grading for factual IOCs/events (60% weight); LLM provides qualitative prose feedback only. |
| **Legal/Trademark objection from CompTIA or TryHackMe** | Medium | Cease-and-desist or trademark warning over course marketing | Forced redesign of landing pages and curriculum references | Adhere strictly to fair-use nominative referencing: "Covers competencies tested in the [Exam Code] examination". No vendor logos or implied endorsements. |
| **Scope creep in SIEM query language parser** | Medium | Attempting to implement full Splunk SPL or Elastic KQL DSL | Delays engine delivery by 3–4 weeks | Enforce rigid 15-operator subset for MVP: `search`, `where`, `stats`, `table`, `top`, `rare`, `sort`, `head`, `tail`, `dedup`, `eval`, `rename`, `count`, `avg`, `sum`. |

---

## 5. Summary Checklist for Owner Sign-Off

- [ ] Select decision options for **D1 through D6**.
- [ ] Assign team member or founder time to verify **F1 through F9** against active vendor portals.
- [ ] Approve reviewer budget (estimated ₹25,000–₹40,000 for initial 6–8 reviewers).
- [ ] Review and approve the updated Roadmap in `docs/specs/2026-10-06-platform-design.md` §14.

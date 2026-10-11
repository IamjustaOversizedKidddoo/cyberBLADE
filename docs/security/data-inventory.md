# CyberBLADE Data Inventory & Privacy Baseline

**Document Version:** 1.0  
**Scope:** Personal Data Collection, Retention, Third-Party Flow & Compliance Foundations (India DPDP Act 2023 & GDPR)

---

## 1. Personal Data Inventory

| Data Element | Purpose | Storage Location | Retention Period | Access Controls | Third Parties Received |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Email Address** | Authentication (OTP Magic Links), session recovery. | Supabase Auth (`auth.users`) | Duration of account lifecycle. Deleted immediately upon account erasure. | Supabase Auth internal schema; not exposed to learners or public APIs. | Supabase Auth service. |
| **OAuth Profile ID & Metadata** | Single Sign-On (Google / GitHub). | Supabase Auth (`auth.identities`) | Account lifecycle. | Supabase Auth internal schema. | Google Identity / GitHub OAuth. |
| **Operator Handle** | Pseudonymous learner identifier shown on leaderboard & session badge. | `public.operators` (hosted) or `operators.json` (local). | Account lifecycle. | Visible to authenticated operator; public leaderboard displays handle & rank only. | None. |
| **Curriculum Progress & Answers** | Tracking completed checks, objectives solved, hint tiers, and rank readiness. | `public.lesson_progress`, `public.lab_attempts`, `public.rank_challenges` | Account lifecycle. | Strictly isolated via Row Level Security (`auth.uid() = user_id`). | None. |
| **XP Rewards Ledger** | Gamification history and achievement certification. | `public.xp_events` | Account lifecycle. | RLS: Learner readable, server append-only. Denies update/delete. | None. |
| **AI Handler Conversation Logs** | Live pedagogical tutoring and hint guidance. | Browser `sessionStorage` (ephemeral), `public.handler_usage` (token counts only). | Session only in browser; token metrics stored for daily quota. | Ephemeral to user tab; daily token counts isolated by user ID. | Google Gemini & Groq (sent as LLM prompt context). |
| **Network IP Address** | Rate limiting, brute-force protection, DDoS defense. | Ephemeral server memory; hashed in security audit log (`ip_hash`). | In-memory sliding windows (60s to 10m). | Ephemeral memory only. | Host infrastructure (Vercel / reverse proxy). |

---

## 2. Third-Party Data Disclosures

CyberBLADE enforces **data minimization**:
1. **Zero Advertising or Behavioral Trackers:** No Google Analytics, Meta Pixel, Hotjar, or advertising SDKs are installed or permitted in client bundles.
2. **AI Model Providers:**
   - **Google Gemini API** (`generativelanguage.googleapis.com`): Receives learner prompts and lesson/lab context excerpts. Learner emails, passwords, and raw IP addresses are **never** transmitted to AI providers.
   - **Groq API** (`api.groq.com`): Secondary AI provider for low-latency Llama-3 inference. Receives prompt texts only.
3. **Authentication Provider:**
   - **Supabase** (`*.supabase.co`): Manages authentication tokens and user credentials.

---

## 3. Data Subject Rights Implementation

CyberBLADE provides full programmatic and API scaffolding for user rights:

### Right to Erasure (Account Deletion)
- Server procedure `delete_user_account(target_user_id UUID)` cascades deletions across:
  - `public.operators`
  - `public.lesson_progress`
  - `public.lab_attempts`
  - `public.xp_events`
  - `public.rank_challenges`
  - `public.handler_usage`
  - `public.attempt_lockouts`
- Local file store removes the operator from `operators.json` and associated records.
- Logs an anonymized audit event `account.deleted` with no preserved PII.

### Right to Portability (Data Export)
- Server action `exportUserDataAction()` extracts all learner records into a standardized, machine-readable JSON structure containing:
  - Account profile (`id`, `handle`, `rank`, `createdAt`)
  - Lesson progress and check history
  - Lab attempts and completed objectives
  - Accumulated XP event ledger
  - Socratic AI tutor usage metrics

---

## 4. Minor Protection & Compliance Considerations (India DPDP Act 2023)

Because CyberBLADE is a learning platform accessible to learners preparing for entry-level cybersecurity careers, learners may include individuals under 18 years of age.

> [!IMPORTANT]
> The following items must be reviewed by legal counsel prior to commercial general availability:

1. **Verifiable Parental Consent (DPDP Act 2023 §9(1)):**
   - The Digital Personal Data Protection Act, 2023 requires data fiduciaries to obtain verifiable consent from the parent or lawful guardian before processing personal data of a child (under 18).
   - *Recommendation:* Implement an age confirmation step during onboarding (`/start`). If the learner indicates they are under 18, require verified parental email verification.
2. **Prohibition of Behavioral Monitoring (§9(2)):**
   - CyberBLADE strictly adheres to this principle: no behavioral profiling, advertising tracking, or engagement surveillance algorithms are employed.
3. **Legal Terms Alignment (`app/legal`):**
   - The current `/legal/ethical-use` page covers computer misuse (IT Act 2000 §§43, 66) and ethical boundaries.
   - A dedicated `/legal/privacy` policy page must be deployed documenting the data controller identity, grievance officer contact, and DPDP rights.

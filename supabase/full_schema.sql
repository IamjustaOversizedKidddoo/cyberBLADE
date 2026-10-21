-- =============================================================================
-- Migration: 20261010000000_phase_2g_initial_schema.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: Initial Schema Migration (Phase 2G)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
-- =============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Operators (Profiles attached to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operators (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL UNIQUE,
    rank INT NOT NULL DEFAULT 0 CHECK (rank >= 0),
    ethics_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Lesson Progress
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    checks_passed TEXT[] NOT NULL DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_lesson UNIQUE (user_id, lesson_id)
);

-- -----------------------------------------------------------------------------
-- 3. Lab Attempts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lab_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('practice', 'challenge')),
    objectives_solved TEXT[] NOT NULL DEFAULT '{}',
    hints_used INT NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 4. XP Events (Idempotent rewards ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    amount INT NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_xp_source UNIQUE (user_id, source)
);

-- -----------------------------------------------------------------------------
-- 5. Rank Challenges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rank_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rank INT NOT NULL CHECK (rank >= 0),
    lab_attempt_id UUID NOT NULL REFERENCES public.lab_attempts(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'passed', 'failed')),
    finished_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 6. Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_operators_handle ON public.operators(handle);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_user_lab ON public.lab_attempts(user_id, lab_id, mode);
CREATE INDEX IF NOT EXISTS idx_xp_events_user ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_challenges_user_rank ON public.rank_challenges(user_id, rank);

-- -----------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_challenges ENABLE ROW LEVEL SECURITY;

-- Operators Policies
CREATE POLICY "Operators can read own profile"
    ON public.operators FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Operators can update own profile"
    ON public.operators FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Operators can insert own profile"
    ON public.operators FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Lesson Progress Policies
CREATE POLICY "Operators can read own lesson progress"
    ON public.lesson_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own lesson progress"
    ON public.lesson_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators can update own lesson progress"
    ON public.lesson_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- Lab Attempts Policies
CREATE POLICY "Operators can read own lab attempts"
    ON public.lab_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own lab attempts"
    ON public.lab_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators can update own lab attempts"
    ON public.lab_attempts FOR UPDATE
    USING (auth.uid() = user_id);

-- XP Events Policies
CREATE POLICY "Operators can read own XP events"
    ON public.xp_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own XP events"
    ON public.xp_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Rank Challenges Policies
CREATE POLICY "Operators can read own challenges"
    ON public.rank_challenges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own challenges"
    ON public.rank_challenges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators can update own challenges"
    ON public.rank_challenges FOR UPDATE
    USING (auth.uid() = user_id);



-- =============================================================================
-- Migration: 20261011120000_p5_security_hardening.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: Security Hardening & P3/P4 State Migration (Phase 5)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds `handler_usage` table for AI tutor daily metering (quota enforcement).
-- 2. Adds `attempt_lockouts` table for rate limiting and challenge lockout state.
-- 3. Adds `audit_events` append-only security ledger for security and audit trail.
-- 4. Hardens RLS on `operators`: drops unrestricted UPDATE/INSERT; enforces rank=0
--    on learner insert and prevents non-admin rank escalation.
-- 5. Hardens RLS on `xp_events`: revokes direct client INSERT to prevent forged XP.
-- 6. Hardens RLS on `rank_challenges`: revokes direct client UPDATE to prevent
--    learners from marking challenges as passed directly.
-- 7. Adds `delete_user_account` SECURITY DEFINER procedure for GDPR/DPDP erasure.
--
-- STATUS:
-- Validated via SQL syntax structure and security policy unit tests.
-- NOT executed against a live hosted database in this local environment pass.
--
-- ROLLBACK INSTRUCTIONS:
-- See documented rollback queries at the end of this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AI Handler Usage Metering Table (P4 Requirement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.handler_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    requests_count INT NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
    input_tokens INT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens INT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_handler_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_handler_usage_lookup ON public.handler_usage (user_id, date);
ALTER TABLE public.handler_usage ENABLE ROW LEVEL SECURITY;

-- Learners can only view their own usage metrics. Mutation is restricted to service-role.
DROP POLICY IF EXISTS "Operators can view own handler usage" ON public.handler_usage;
CREATE POLICY "Operators can view own handler usage"
    ON public.handler_usage FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. Anti-Cheat & Attempt Rate-Limit Lockout State Table (P3 Requirement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attempt_lockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL,
    attempts_count INT NOT NULL DEFAULT 1 CHECK (attempts_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_action_lockout UNIQUE (user_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_attempt_lockouts_lookup ON public.attempt_lockouts (user_id, action_type);
ALTER TABLE public.attempt_lockouts ENABLE ROW LEVEL SECURITY;

-- Learners can view their own lockout status. Mutated strictly by server-side logic.
DROP POLICY IF EXISTS "Operators can view own lockouts" ON public.attempt_lockouts;
CREATE POLICY "Operators can view own lockouts"
    ON public.attempt_lockouts FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Append-Only Security Audit Ledger (Part H Requirement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'security_alert')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_time ON public.audit_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON public.audit_events (event_type);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Append-only: normal users can read their own events if authenticated, but NEVER update or delete.
DROP POLICY IF EXISTS "Operators can view own audit entries" ON public.audit_events;
CREATE POLICY "Operators can view own audit entries"
    ON public.audit_events FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. Progression Invariant Hardening on Existing Tables
-- -----------------------------------------------------------------------------

-- 4A. Operators Profile Hardening (Prevent Rank Escalation & Unauthorized Inserts)
DROP POLICY IF EXISTS "Operators can insert own profile" ON public.operators;
CREATE POLICY "Operators can insert own profile"
    ON public.operators FOR INSERT
    WITH CHECK (auth.uid() = id AND rank = 0);

DROP POLICY IF EXISTS "Operators can update own profile" ON public.operators;
CREATE POLICY "Operators can update own profile"
    ON public.operators FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Trigger function with fixed search_path to prevent non-service-role rank tampering
CREATE OR REPLACE FUNCTION public.prevent_operator_rank_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If current user is authenticated learner (not postgres superuser or service role)
    IF (auth.role() = 'authenticated' AND NEW.rank <> OLD.rank) THEN
        RAISE EXCEPTION 'Unauthorized: Operator rank can only be modified through authoritative server actions.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_operator_rank_escalation ON public.operators;
CREATE TRIGGER trg_prevent_operator_rank_escalation
    BEFORE UPDATE ON public.operators
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_operator_rank_escalation();

-- 4B. XP Events Ledger Hardening (Prevent Arbitrary XP Insertion by Learners)
-- Drop permissive insert policy. XP must be inserted through server service-role client.
DROP POLICY IF EXISTS "Operators can insert own XP events" ON public.xp_events;

-- Ensure XP ledger has no UPDATE or DELETE policies for authenticated learners.
DROP POLICY IF EXISTS "Operators can update own XP events" ON public.xp_events;
DROP POLICY IF EXISTS "Operators can delete own XP events" ON public.xp_events;

-- 4C. Rank Challenges Hardening (Prevent Marking Challenge as 'passed' Directly)
-- Drop permissive update policy. Rank challenge completion is authoritative server-only.
DROP POLICY IF EXISTS "Operators can update own challenges" ON public.rank_challenges;

-- -----------------------------------------------------------------------------
-- 5. User Account Deletion & Right to Erasure (DPDP Act 2023 / GDPR)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Verify caller owns the account or is service-role
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- Delete user profile and cascading progress rows
    DELETE FROM public.operators WHERE id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;

    -- Audit the account deletion without preserving PII
    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;

-- =============================================================================
-- ROLLBACK NOTES:
-- To cleanly roll back this migration:
-- DROP FUNCTION IF EXISTS public.delete_user_account(UUID);
-- DROP TRIGGER IF EXISTS trg_prevent_operator_rank_escalation ON public.operators;
-- DROP FUNCTION IF EXISTS public.prevent_operator_rank_escalation();
-- DROP TABLE IF EXISTS public.audit_events CASCADE;
-- DROP TABLE IF EXISTS public.attempt_lockouts CASCADE;
-- DROP TABLE IF EXISTS public.handler_usage CASCADE;
-- Restore original policies from 20261010000000_phase_2g_initial_schema.sql if required.
-- =============================================================================



-- =============================================================================
-- Migration: 20261012000000_p8_learning_effectiveness.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: Learning Effectiveness & Spaced Review Schema (Phase 8)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds `review_items` table for SM-2 spaced repetition state tracking per user.
-- 2. Adds `review_events` append-only log for retrieval practice audit & telemetry.
-- 3. Adds `learning_events` privacy-preserving analytics ledger for formative study.
-- 4. Adds `exam_reports` private self-reporting table for certification alignment.
-- 5. Enables strict Row Level Security (RLS) on all 4 tables with owner-only isolation.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.exam_reports CASCADE;
-- DROP TABLE IF EXISTS public.learning_events CASCADE;
-- DROP TABLE IF EXISTS public.review_events CASCADE;
-- DROP TABLE IF EXISTS public.review_items CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Review Items Table (SM-2 Spaced Repetition State)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30),
    interval_days INT NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
    repetitions INT NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
    lapses INT NOT NULL DEFAULT 0 CHECK (lapses >= 0),
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_item_user_card UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_review_items_user_due ON public.review_items (user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_review_items_user_card ON public.review_items (user_id, card_id);
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own review items" ON public.review_items;
CREATE POLICY "Operators manage own review items"
    ON public.review_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. Review Events Log (Retrieval Practice Attempt History)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    grade INT NOT NULL CHECK (grade >= 0 AND grade <= 5),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_events_user_time ON public.review_events (user_id, reviewed_at);
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own review events" ON public.review_events;
CREATE POLICY "Operators manage own review events"
    ON public.review_events FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Learning Events Telemetry (Privacy-Preserving Formative Analytics)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_type ON public.learning_events (user_id, event_type);
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators view own learning events" ON public.learning_events;
CREATE POLICY "Operators view own learning events"
    ON public.learning_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Operators insert own learning events" ON public.learning_events;
CREATE POLICY "Operators insert own learning events"
    ON public.learning_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. Certification Exam Self-Reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,
    score INT NOT NULL CHECK (score >= 0),
    max_score INT NOT NULL CHECK (max_score > 0),
    passed BOOLEAN NOT NULL,
    notes TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_reports_user_time ON public.exam_reports (user_id, reported_at);
ALTER TABLE public.exam_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own exam reports" ON public.exam_reports;
CREATE POLICY "Operators manage own exam reports"
    ON public.exam_reports FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);



-- =============================================================================
-- Migration: 20261012120000_phase_3_soc_workspace.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: SOC Workspace & Decision Pipeline Schema (Phase 3)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds `soc_attempts` table tracking learner shift sessions per scenario.
-- 2. Adds `soc_decisions` append-only immutable log for alert triage decisions.
-- 3. Adds `soc_cases` table for incident grouping, notes, and severity tracking.
-- 4. Adds `soc_case_alerts` join table associating alerts with active cases.
-- 5. Enables strict Row Level Security (RLS) on all 4 tables with owner-only isolation.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_case_alerts CASCADE;
-- DROP TABLE IF EXISTS public.soc_cases CASCADE;
-- DROP TABLE IF EXISTS public.soc_decisions CASCADE;
-- DROP TABLE IF EXISTS public.soc_attempts CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SOC Attempts Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    seed TEXT NOT NULL DEFAULT 'default',
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'expired')),
    score_summary JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_attempts_user ON public.soc_attempts (user_id, scenario_id);
CREATE INDEX IF NOT EXISTS idx_soc_attempts_status ON public.soc_attempts (user_id, status);
ALTER TABLE public.soc_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc attempts" ON public.soc_attempts;
CREATE POLICY "Operators manage own soc attempts"
    ON public.soc_attempts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. SOC Decisions Log (Append-Only Triage Decision History)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL,
    disposition TEXT NOT NULL CHECK (disposition IN ('true_positive', 'false_positive', 'benign_true_positive', 'duplicate', 'needs_more_info')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    escalate BOOLEAN NOT NULL DEFAULT false,
    target_tier TEXT CHECK (target_tier IS NULL OR target_tier IN ('tier2', 'incident_response', 'threat_intel', 'engineering')),
    rationale TEXT NOT NULL,
    evidence_refs TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_decisions_attempt ON public.soc_decisions (attempt_id, alert_id);
ALTER TABLE public.soc_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc decisions" ON public.soc_decisions;
CREATE POLICY "Operators manage own soc decisions"
    ON public.soc_decisions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_decisions.attempt_id AND a.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_decisions.attempt_id AND a.user_id = auth.uid()
    ));

-- -----------------------------------------------------------------------------
-- 3. SOC Cases Table (Incident Grouping & Notes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'escalated', 'closed')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_cases_attempt ON public.soc_cases (attempt_id);
ALTER TABLE public.soc_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc cases" ON public.soc_cases;
CREATE POLICY "Operators manage own soc cases"
    ON public.soc_cases FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_cases.attempt_id AND a.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_cases.attempt_id AND a.user_id = auth.uid()
    ));

-- -----------------------------------------------------------------------------
-- 4. SOC Case Alerts Join Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_case_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.soc_cases(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_case_alert UNIQUE (case_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_soc_case_alerts_case ON public.soc_case_alerts (case_id);
ALTER TABLE public.soc_case_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc case alerts" ON public.soc_case_alerts;
CREATE POLICY "Operators manage own soc case alerts"
    ON public.soc_case_alerts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.soc_cases c
        JOIN public.soc_attempts a ON a.id = c.attempt_id
        WHERE c.id = soc_case_alerts.case_id AND a.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.soc_cases c
        JOIN public.soc_attempts a ON a.id = c.attempt_id
        WHERE c.id = soc_case_alerts.case_id AND a.user_id = auth.uid()
    ));



-- =============================================================================
-- Migration: 20261013000000_phase_3_soc_scenario_generation.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: SOC Workspace Scenario Generation Schema (Phase 3 Part F)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds procedural generation tracking columns to `public.soc_attempts`:
--    - family_id TEXT: ID of the scenario family (e.g. 'soc-f-mixed-signal-01')
--    - family_version INTEGER: pinned family schema version
--    - generator_version TEXT: pinned generator version (e.g. '1.0.0')
--    - difficulty TEXT: difficulty level ('beginner', 'intermediate', 'advanced')
--    - scenario_hash TEXT: SHA256 content hash of the generated scenario for tampering/drift detection
-- 2. Creates `public.soc_used_seeds` table to track used seeds per (user, family),
--    preventing seed reuse in practice and exam retakes.
-- 3. Enables strict Row Level Security (RLS) on `soc_used_seeds` (owner-only).
-- 4. Enforces zero-knowledge seed protection: revokes SELECT on the `seed` column
--    of `soc_attempts` from the authenticated role, ensuring even the attempt owner
--    cannot inspect or reconstruct answers offline.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_used_seeds CASCADE;
-- ALTER TABLE public.soc_attempts
--   DROP COLUMN IF EXISTS family_id,
--   DROP COLUMN IF EXISTS family_version,
--   DROP COLUMN IF EXISTS generator_version,
--   DROP COLUMN IF EXISTS difficulty,
--   DROP COLUMN IF EXISTS scenario_hash;
-- =============================================================================

-- 1. Additive columns on soc_attempts
ALTER TABLE public.soc_attempts
    ADD COLUMN IF NOT EXISTS family_id TEXT,
    ADD COLUMN IF NOT EXISTS family_version INTEGER,
    ADD COLUMN IF NOT EXISTS generator_version TEXT,
    ADD COLUMN IF NOT EXISTS difficulty TEXT,
    ADD COLUMN IF NOT EXISTS scenario_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_soc_attempts_family ON public.soc_attempts (user_id, family_id);

-- 2. Used Seeds Table for non-repeating attempt seeds per (user, family)
CREATE TABLE IF NOT EXISTS public.soc_used_seeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_soc_used_seeds UNIQUE (user_id, family_id, seed)
);

CREATE INDEX IF NOT EXISTS idx_soc_used_seeds_lookup ON public.soc_used_seeds (user_id, family_id);
ALTER TABLE public.soc_used_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc used seeds" ON public.soc_used_seeds;
CREATE POLICY "Operators manage own soc used seeds"
    ON public.soc_used_seeds FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Zero-Knowledge Seed Protection:
-- Revoke direct SELECT privilege on the sensitive seed column from learner client roles
REVOKE SELECT (seed) ON public.soc_attempts FROM authenticated;



-- =============================================================================
-- Migration: 20261013120000_phase_3_soc_enrichment.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: SOC Enrichment and Evidence Layer Schema (Phase 3 Prompt 4)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Creates `public.soc_enrichment_lookups` append-only audit table to log every
--    simulated intelligence lookup requested by a learner:
--    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE
--    - user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
--    - tool TEXT NOT NULL (e.g. 'reputation', 'whois', 'pdns', 'email_headers', etc.)
--    - entity_type TEXT NOT NULL ('ip', 'domain', 'url', 'hash', 'email', 'user', 'host')
--    - entity_value TEXT NOT NULL (canonicalized identifier queried)
--    - response_hash TEXT NOT NULL (SHA-256 hash of deterministic payload for integrity)
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- 2. Enables strict Row Level Security (RLS) on `soc_enrichment_lookups` (owner-only).
-- 3. Adds indexing for rapid per-attempt audit timeline replay and rate limiting.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_enrichment_lookups CASCADE;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.soc_enrichment_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    response_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_enrichment_lookups_attempt 
    ON public.soc_enrichment_lookups (attempt_id, created_at);

CREATE INDEX IF NOT EXISTS idx_soc_enrichment_lookups_user_tool 
    ON public.soc_enrichment_lookups (user_id, tool, created_at);

ALTER TABLE public.soc_enrichment_lookups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners insert own enrichment lookups" ON public.soc_enrichment_lookups;
CREATE POLICY "Learners insert own enrichment lookups"
    ON public.soc_enrichment_lookups FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners view own enrichment lookups" ON public.soc_enrichment_lookups;
CREATE POLICY "Learners view own enrichment lookups"
    ON public.soc_enrichment_lookups FOR SELECT
    USING (auth.uid() = user_id);



-- =============================================================================
-- Migration: 20261013180000_phase_3_soc_query_language.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: SOC Investigation Query Language & Questions Schema (Phase 3 Prompt 5)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Creates `public.soc_query_logs` append-only audit table to log every
--    investigation query executed by a learner in BladeQL:
--    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE
--    - user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
--    - language_version TEXT NOT NULL (pinned e.g. '1.0.0')
--    - query_text TEXT NOT NULL (limited to 4,000 characters)
--    - result_row_count INTEGER NOT NULL DEFAULT 0
--    - execution_steps INTEGER NOT NULL DEFAULT 0
--    - duration_ms INTEGER NOT NULL DEFAULT 0
--    - budget_flags JSONB NOT NULL DEFAULT '{}'::jsonb
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--
-- 2. Creates `public.soc_question_attempts` table to store server-verified
--    investigation question responses (SAL1/BTL1 style):
--    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE
--    - user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
--    - question_id TEXT NOT NULL
--    - submitted_answer TEXT NOT NULL
--    - is_correct BOOLEAN NOT NULL DEFAULT FALSE
--    - attempts_used INTEGER NOT NULL DEFAULT 1
--    - hints_used INTEGER NOT NULL DEFAULT 0
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--
-- 3. Enables strict Row Level Security (RLS) on both tables (owner-only).
-- 4. Adds indexing for rapid per-attempt audit retrieval and question state queries.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local memory/repository mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_question_attempts CASCADE;
-- DROP TABLE IF EXISTS public.soc_query_logs CASCADE;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.soc_query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language_version TEXT NOT NULL DEFAULT '1.0.0',
    query_text TEXT NOT NULL,
    result_row_count INTEGER NOT NULL DEFAULT 0,
    execution_steps INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    budget_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_query_logs_attempt 
    ON public.soc_query_logs (attempt_id, created_at);

CREATE INDEX IF NOT EXISTS idx_soc_query_logs_user 
    ON public.soc_query_logs (user_id, created_at);

ALTER TABLE public.soc_query_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners insert own query logs" ON public.soc_query_logs;
CREATE POLICY "Learners insert own query logs"
    ON public.soc_query_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners view own query logs" ON public.soc_query_logs;
CREATE POLICY "Learners view own query logs"
    ON public.soc_query_logs FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Investigation Questions Verification
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.soc_question_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    submitted_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    attempts_used INTEGER NOT NULL DEFAULT 1,
    hints_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_question_attempts_attempt 
    ON public.soc_question_attempts (attempt_id, question_id);

ALTER TABLE public.soc_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners insert own question attempts" ON public.soc_question_attempts;
CREATE POLICY "Learners insert own question attempts"
    ON public.soc_question_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners view own question attempts" ON public.soc_question_attempts;
CREATE POLICY "Learners view own question attempts"
    ON public.soc_question_attempts FOR SELECT
    USING (auth.uid() = user_id);



-- =============================================================================
-- Migration: 20261013200000_phase_3_soc_report_engine.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Platform: SOC Incident Report Submissions & Evaluations (Phase 3 Prompt 6)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Creates `public.soc_report_submissions` â€” append-only draft/submission log:
--    - id UUID PRIMARY KEY
--    - attempt_id UUID NOT NULL REFERENCES soc_attempts
--    - user_id UUID NOT NULL REFERENCES auth.users
--    - template_id TEXT NOT NULL (e.g. 'incident-report-l1')
--    - template_version TEXT NOT NULL (e.g. 'v1.0.0')
--    - status TEXT NOT NULL CHECK ('draft' | 'submitted')
--    - report_data JSONB NOT NULL (full SocReportData payload)
--    - lint_results JSONB (pre-submit lint output; null until first lint run)
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--    - updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--
-- 2. Creates `public.soc_report_evaluations` â€” one row per graded submission:
--    - id UUID PRIMARY KEY
--    - submission_id UUID NOT NULL REFERENCES soc_report_submissions UNIQUE
--    - attempt_id UUID NOT NULL REFERENCES soc_attempts
--    - user_id UUID NOT NULL REFERENCES auth.users
--    - rubric_id TEXT NOT NULL
--    - rubric_version TEXT NOT NULL
--    - grader_version TEXT NOT NULL
--    - scoring_version TEXT NOT NULL
--    - total_score NUMERIC(6,2) NOT NULL
--    - max_score NUMERIC(6,2) NOT NULL DEFAULT 100
--    - is_fully_graded BOOLEAN NOT NULL DEFAULT FALSE
--    - criterion_results JSONB NOT NULL (per-criterion breakdown)
--    - flags JSONB NOT NULL DEFAULT '{}'
--    - version_label TEXT NOT NULL
--    - computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--
--    NOTE: model_report_reveal JSONB is intentionally stored server-side only;
--    it is never embedded in the evaluation row accessible by the learner
--    before submission. The reveal payload is fetched from a separate,
--    post-submission-only RPC, enforcing ground-truth containment.
--
-- 3. Enables strict Row Level Security (RLS) on both tables (owner-only).
-- 4. Adds composite indexes for rapid per-attempt report and evaluation retrieval.
-- 5. Adds a trigger to keep updated_at current on soc_report_submissions.
--
-- GROUND TRUTH CONTAINMENT:
-- The `soc_report_evaluations` table stores criterion_results but NOT
-- the model_report_reveal. The model report is derived at query time from
-- the scenario's ground-truth synthesis function and injected by the server
-- action only after evaluating attempt.status = 'submitted'.
--
-- STATUS:
-- Not executed against a live hosted database. Re-runnable (2026-10-14, S5): triggers and
-- policies are dropped-if-exists before creation; verified by tests/db (PGlite) applying all
-- migrations twice. The trigger helper is SECURITY INVOKER (S4): it needs no elevated rights.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_report_evaluations CASCADE;
-- DROP TABLE IF EXISTS public.soc_report_submissions CASCADE;
-- DROP TRIGGER IF EXISTS trg_soc_report_submissions_updated_at ON public.soc_report_submissions;
-- DROP FUNCTION IF EXISTS public.set_updated_at();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Updated-at trigger function (reuse if already exists)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. soc_report_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_report_submissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id    UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id   TEXT NOT NULL DEFAULT 'incident-report-l1',
    template_version TEXT NOT NULL DEFAULT 'v1.0.0',
    status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted')),
    report_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
    lint_results  JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One draft per (attempt, template) â€” on conflict update in place
CREATE UNIQUE INDEX IF NOT EXISTS idx_soc_report_submissions_draft
    ON public.soc_report_submissions (attempt_id, template_id)
    WHERE (status = 'draft');

CREATE INDEX IF NOT EXISTS idx_soc_report_submissions_attempt
    ON public.soc_report_submissions (attempt_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_soc_report_submissions_user
    ON public.soc_report_submissions (user_id, updated_at DESC);

-- Keep updated_at current
DROP TRIGGER IF EXISTS trg_soc_report_submissions_updated_at ON public.soc_report_submissions;
CREATE TRIGGER trg_soc_report_submissions_updated_at
    BEFORE UPDATE ON public.soc_report_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.soc_report_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS soc_report_submissions_owner_select ON public.soc_report_submissions;
CREATE POLICY soc_report_submissions_owner_select
    ON public.soc_report_submissions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS soc_report_submissions_owner_insert ON public.soc_report_submissions;
CREATE POLICY soc_report_submissions_owner_insert
    ON public.soc_report_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS soc_report_submissions_owner_update ON public.soc_report_submissions;
CREATE POLICY soc_report_submissions_owner_update
    ON public.soc_report_submissions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- No DELETE policy intentionally: submissions are immutable audit records.

-- ---------------------------------------------------------------------------
-- 2. soc_report_evaluations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_report_evaluations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id    UUID NOT NULL UNIQUE REFERENCES public.soc_report_submissions(id) ON DELETE CASCADE,
    attempt_id       UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rubric_id        TEXT NOT NULL DEFAULT 'incident-report-l1-rubric',
    rubric_version   TEXT NOT NULL,
    grader_version   TEXT NOT NULL,
    scoring_version  TEXT NOT NULL,
    total_score      NUMERIC(6,2) NOT NULL,
    max_score        NUMERIC(6,2) NOT NULL DEFAULT 100.00,
    is_fully_graded  BOOLEAN NOT NULL DEFAULT FALSE,
    criterion_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    flags            JSONB NOT NULL DEFAULT '{}'::jsonb,
    version_label    TEXT NOT NULL,
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- NOTE: model_report_reveal is NOT stored here (ground-truth containment).
    -- It is returned only by the post-submission server action.
);

CREATE INDEX IF NOT EXISTS idx_soc_report_evaluations_attempt
    ON public.soc_report_evaluations (attempt_id);

CREATE INDEX IF NOT EXISTS idx_soc_report_evaluations_user
    ON public.soc_report_evaluations (user_id, computed_at DESC);

-- RLS: learner can read their own evaluation; no write access from client
ALTER TABLE public.soc_report_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS soc_report_evaluations_owner_select ON public.soc_report_evaluations;
CREATE POLICY soc_report_evaluations_owner_select
    ON public.soc_report_evaluations FOR SELECT
    USING (auth.uid() = user_id);

-- Evaluations are only written by the service role (server action), not by the client.
-- No INSERT/UPDATE policy for authenticated role.



-- =============================================================================
-- Migration: 20261014120000_phase_3_soc_ai_grading.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE Phase 3 Prompt 7: AI-assisted report grading (communication criteria)
--
-- STATUS: NOT EXECUTED AGAINST A DATABASE. Checked statically by
--         tests/security/soc-ai-grading-migration.test.ts. Never run against a hosted project
--         from this repo; apply through the normal reviewed deploy path.
--
-- ADDITIVE + IDEMPOTENT: CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY,
-- CREATE OR REPLACE FUNCTION. No existing table, policy or function is modified.
--
-- ACCESS MODEL
--   All writes come from the server with the service role (bypasses RLS).
--   Learners (authenticated) may SELECT only their own rows in:
--     soc_ai_criterion_grades, soc_ai_human_review_requests, soc_ai_calibration_consent.
--   Learners can read NOTHING in: soc_ai_grading_jobs, soc_ai_raw_outputs,
--     soc_ai_review_items, soc_ai_usage_daily (RLS on, no policies, privileges revoked).
--   Raw model outputs and prompt hashes therefore never reach a user-scoped client.
--
-- ROLLBACK (reverse order):
--   DROP FUNCTION IF EXISTS public.soc_ai_claim_jobs(INTEGER, INTEGER);
--   DROP TABLE IF EXISTS public.soc_ai_usage_daily;
--   DROP TABLE IF EXISTS public.soc_ai_calibration_consent;
--   DROP TABLE IF EXISTS public.soc_ai_human_review_requests;
--   DROP TABLE IF EXISTS public.soc_ai_review_items;
--   DROP TABLE IF EXISTS public.soc_ai_raw_outputs;
--   DROP TABLE IF EXISTS public.soc_ai_criterion_grades;
--   DROP TABLE IF EXISTS public.soc_ai_grading_jobs;
-- =============================================================================

-- 1. Job queue (service role only) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_ai_grading_jobs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id    UUID NOT NULL REFERENCES public.soc_report_submissions(id) ON DELETE CASCADE,
    attempt_id       UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criterion_id     TEXT NOT NULL CHECK (criterion_id ~ '^[a-z_]{1,64}$'),
    idempotency_key  TEXT NOT NULL UNIQUE CHECK (char_length(idempotency_key) = 64),
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'dead')),
    attempts         INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_until      TIMESTAMPTZ,
    last_error_code  TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 120),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soc_ai_jobs_due ON public.soc_ai_grading_jobs (status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_soc_ai_jobs_submission ON public.soc_ai_grading_jobs (submission_id);
CREATE INDEX IF NOT EXISTS idx_soc_ai_jobs_user ON public.soc_ai_grading_jobs (user_id);
ALTER TABLE public.soc_ai_grading_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_grading_jobs FROM anon, authenticated;

-- 2. Criterion grades (append-only; overrides are new rows) ------------------
CREATE TABLE IF NOT EXISTS public.soc_ai_criterion_grades (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id      UUID NOT NULL REFERENCES public.soc_report_submissions(id) ON DELETE CASCADE,
    attempt_id         UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criterion_id       TEXT NOT NULL CHECK (criterion_id ~ '^[a-z_]{1,64}$'),
    status             TEXT NOT NULL CHECK (status IN ('graded', 'not_graded', 'needs_review')),
    not_graded_reason  TEXT,
    band               SMALLINT CHECK (band IS NULL OR band BETWEEN 0 AND 3),
    confidence         TEXT CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
    eligible_to_count  BOOLEAN NOT NULL DEFAULT FALSE,
    feedback           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- tone-filtered, template-built learner text only
    verified_spans     JSONB NOT NULL DEFAULT '[]'::jsonb,   -- verbatim quotes of the learner's own text
    flags              JSONB NOT NULL DEFAULT '[]'::jsonb,
    ai_rubric_id       TEXT NOT NULL,
    ai_rubric_version  TEXT NOT NULL,
    prompt_version     TEXT NOT NULL,
    grader_version     TEXT NOT NULL,
    model_id           TEXT NOT NULL,
    params             JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_hash         TEXT NOT NULL,
    cache_key          TEXT NOT NULL,
    input_tokens       INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens      INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    source             TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'human_accept', 'human_override')),
    supersedes_id      UUID REFERENCES public.soc_ai_criterion_grades(id) ON DELETE SET NULL,
    reviewer_pseudonym TEXT CHECK (reviewer_pseudonym IS NULL OR reviewer_pseudonym ~ '^[A-Za-z0-9_-]{1,40}$'),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soc_ai_grades_submission ON public.soc_ai_criterion_grades (submission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_soc_ai_grades_cache ON public.soc_ai_criterion_grades (user_id, cache_key);
ALTER TABLE public.soc_ai_criterion_grades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_criterion_grades FROM anon, authenticated;
GRANT SELECT ON public.soc_ai_criterion_grades TO authenticated;
DROP POLICY IF EXISTS "Learners view own AI grades" ON public.soc_ai_criterion_grades;
CREATE POLICY "Learners view own AI grades"
    ON public.soc_ai_criterion_grades FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 3. Raw model outputs (service role ONLY; never learner-readable) -----------
CREATE TABLE IF NOT EXISTS public.soc_ai_raw_outputs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id      UUID NOT NULL REFERENCES public.soc_ai_criterion_grades(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sample_index  SMALLINT NOT NULL CHECK (sample_index BETWEEN 0 AND 15),
    attempt       SMALLINT NOT NULL CHECK (attempt BETWEEN 1 AND 3),
    raw_text      TEXT NOT NULL CHECK (char_length(raw_text) <= 8000),
    prompt_hash   TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soc_ai_raw_grade ON public.soc_ai_raw_outputs (grade_id);
ALTER TABLE public.soc_ai_raw_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_ai_raw_outputs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_raw_outputs FROM PUBLIC, anon, authenticated;

-- 4. Review queue (service role only) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_ai_review_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id          UUID NOT NULL REFERENCES public.soc_ai_criterion_grades(id) ON DELETE CASCADE,
    submission_id     UUID NOT NULL REFERENCES public.soc_report_submissions(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criterion_id      TEXT NOT NULL,
    reason            TEXT NOT NULL CHECK (reason IN ('low_confidence', 'needs_review', 'injection_flagged', 'random_sample', 'learner_request')),
    status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolution        TEXT CHECK (resolution IS NULL OR resolution IN ('accepted', 'overridden')),
    resolved_grade_id UUID REFERENCES public.soc_ai_criterion_grades(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_soc_ai_review_open ON public.soc_ai_review_items (status, created_at);
CREATE INDEX IF NOT EXISTS idx_soc_ai_review_submission ON public.soc_ai_review_items (submission_id);
ALTER TABLE public.soc_ai_review_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_review_items FROM anon, authenticated;

-- 5. Learner "request human review" (one per submission) ---------------------
CREATE TABLE IF NOT EXISTS public.soc_ai_human_review_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id  UUID NOT NULL UNIQUE REFERENCES public.soc_report_submissions(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.soc_ai_human_review_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_human_review_requests FROM anon, authenticated;
GRANT SELECT ON public.soc_ai_human_review_requests TO authenticated;
DROP POLICY IF EXISTS "Learners view own review requests" ON public.soc_ai_human_review_requests;
CREATE POLICY "Learners view own review requests"
    ON public.soc_ai_human_review_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 6. Calibration consent (opt-in, default absent = no consent) ---------------
CREATE TABLE IF NOT EXISTS public.soc_ai_calibration_consent (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted          BOOLEAN NOT NULL DEFAULT FALSE,
    consent_version  TEXT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.soc_ai_calibration_consent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_calibration_consent FROM anon, authenticated;
GRANT SELECT ON public.soc_ai_calibration_consent TO authenticated;
DROP POLICY IF EXISTS "Learners view own calibration consent" ON public.soc_ai_calibration_consent;
CREATE POLICY "Learners view own calibration consent"
    ON public.soc_ai_calibration_consent FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. Usage counters for quotas and the global ceiling (service role only) ----
CREATE TABLE IF NOT EXISTS public.soc_ai_usage_daily (
    usage_key           TEXT PRIMARY KEY CHECK (char_length(usage_key) <= 120),
    submissions_graded  INTEGER NOT NULL DEFAULT 0,
    input_tokens        BIGINT NOT NULL DEFAULT 0,
    output_tokens       BIGINT NOT NULL DEFAULT 0
);
ALTER TABLE public.soc_ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_ai_usage_daily FROM anon, authenticated;

-- 8. Atomic job claim for concurrent workers (service role only) -------------
-- SECURITY INVOKER on purpose: only the service role may execute it, and it needs no
-- privilege escalation. search_path is pinned against hijacking.
CREATE OR REPLACE FUNCTION public.soc_ai_claim_jobs(p_limit INTEGER, p_lease_seconds INTEGER)
RETURNS SETOF public.soc_ai_grading_jobs
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    UPDATE public.soc_ai_grading_jobs AS j
       SET status = 'running',
           lease_until = NOW() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
           updated_at = NOW()
     WHERE j.id IN (
            SELECT id FROM public.soc_ai_grading_jobs
             WHERE (status = 'pending' AND next_run_at <= NOW())
                OR (status = 'running' AND (lease_until IS NULL OR lease_until <= NOW()))
             ORDER BY next_run_at
             LIMIT LEAST(GREATEST(p_limit, 1), 100)
             FOR UPDATE SKIP LOCKED)
    RETURNING j.*;
$$;
REVOKE ALL ON FUNCTION public.soc_ai_claim_jobs(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

-- 9. Atomic usage increment (service role only) ------------------------------
CREATE OR REPLACE FUNCTION public.soc_ai_add_usage(p_key TEXT, p_submissions INTEGER, p_input BIGINT, p_output BIGINT)
RETURNS public.soc_ai_usage_daily
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    INSERT INTO public.soc_ai_usage_daily AS u (usage_key, submissions_graded, input_tokens, output_tokens)
    VALUES (p_key, p_submissions, p_input, p_output)
    ON CONFLICT (usage_key) DO UPDATE
       SET submissions_graded = u.submissions_graded + EXCLUDED.submissions_graded,
           input_tokens = u.input_tokens + EXCLUDED.input_tokens,
           output_tokens = u.output_tokens + EXCLUDED.output_tokens
    RETURNING u.*;
$$;
REVOKE ALL ON FUNCTION public.soc_ai_add_usage(TEXT, INTEGER, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;



-- =============================================================================
-- Migration: 20261014180000_phase_3_access_hardening.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE: learner access hardening (closes audit findings S1, S2, S3, S6; S4 follow-up)
--
-- STATUS: NOT EXECUTED AGAINST A HOSTED DATABASE. Executed locally against PGlite with
-- Supabase-like roles by tests/db/access-hardening.test.ts (all migrations, twice).
--
-- WHY
--   S1/S3  Learners could INSERT/UPDATE grading data directly with the Supabase client
--          (attempt status/scores, decisions, question correctness, report content, lab
--          objectives, lesson progress, challenge rows). The app writes all of these through
--          the service role, so learners now get read-only access.
--   S2     `REVOKE SELECT (seed)` had no effect while Supabase's default table-level SELECT grant
--          existed, and `soc_used_seeds` was fully readable. Seeds are now unreadable: table-level
--          privileges are revoked and only non-secret columns are granted back.
--   S3     Submitted reports are immutable for EVERY role (trigger), not just by app convention.
--   S6     delete_user_account() now erases every learner table added since Phase 2.
--
-- ADDITIVE + IDEMPOTENT: DROP ... IF EXISTS before CREATE; CREATE OR REPLACE for functions;
-- REVOKE/GRANT are naturally repeatable. No existing migration is edited.
--
-- ROLLBACK (restores the previous, weaker state; only for an emergency):
--   DROP TRIGGER IF EXISTS trg_soc_report_submissions_immutable ON public.soc_report_submissions;
--   DROP FUNCTION IF EXISTS public.soc_block_submitted_report_update();
--   GRANT ALL ON <tables below> TO authenticated;  -- and re-create the dropped policies from
--   20261010000000, 20261012120000, 20261013000000, 20261013120000, 20261013180000, 20261013200000.
--   delete_user_account(): re-apply its body from 20261011120000.
-- =============================================================================

-- 1. Drop every learner WRITE policy on grading data ---------------------------
DROP POLICY IF EXISTS "Operators can insert own lesson progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Operators can update own lesson progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Operators can insert own lab attempts" ON public.lab_attempts;
DROP POLICY IF EXISTS "Operators can update own lab attempts" ON public.lab_attempts;
DROP POLICY IF EXISTS "Operators can insert own challenges" ON public.rank_challenges;
DROP POLICY IF EXISTS "Operators manage own soc attempts" ON public.soc_attempts;
DROP POLICY IF EXISTS "Operators manage own soc decisions" ON public.soc_decisions;
DROP POLICY IF EXISTS "Operators manage own soc cases" ON public.soc_cases;
DROP POLICY IF EXISTS "Operators manage own soc case alerts" ON public.soc_case_alerts;
DROP POLICY IF EXISTS "Operators manage own soc used seeds" ON public.soc_used_seeds;
DROP POLICY IF EXISTS "Learners insert own enrichment lookups" ON public.soc_enrichment_lookups;
DROP POLICY IF EXISTS "Learners insert own query logs" ON public.soc_query_logs;
DROP POLICY IF EXISTS "Learners insert own question attempts" ON public.soc_question_attempts;
DROP POLICY IF EXISTS soc_report_submissions_owner_insert ON public.soc_report_submissions;
DROP POLICY IF EXISTS soc_report_submissions_owner_update ON public.soc_report_submissions;

-- 2. Read-only replacements where the old policy was FOR ALL -------------------
DROP POLICY IF EXISTS "Learners read own soc attempts" ON public.soc_attempts;
CREATE POLICY "Learners read own soc attempts"
    ON public.soc_attempts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners read own soc decisions" ON public.soc_decisions;
CREATE POLICY "Learners read own soc decisions"
    ON public.soc_decisions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.soc_attempts a WHERE a.id = soc_decisions.attempt_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Learners read own soc cases" ON public.soc_cases;
CREATE POLICY "Learners read own soc cases"
    ON public.soc_cases FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.soc_attempts a WHERE a.id = soc_cases.attempt_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Learners read own soc case alerts" ON public.soc_case_alerts;
CREATE POLICY "Learners read own soc case alerts"
    ON public.soc_case_alerts FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.soc_cases c JOIN public.soc_attempts a ON a.id = c.attempt_id
       WHERE c.id = soc_case_alerts.case_id AND a.user_id = auth.uid()));
-- soc_used_seeds: no learner policy at all.

-- 3. Privileges: learners SELECT only; anon nothing; secret columns never granted ----
REVOKE ALL ON
    public.lesson_progress, public.lab_attempts, public.xp_events, public.rank_challenges,
    public.soc_attempts, public.soc_decisions, public.soc_cases, public.soc_case_alerts,
    public.soc_used_seeds, public.soc_enrichment_lookups, public.soc_query_logs,
    public.soc_question_attempts, public.soc_report_submissions, public.soc_report_evaluations
  FROM anon, authenticated;

GRANT SELECT ON
    public.lesson_progress, public.xp_events, public.rank_challenges,
    public.soc_decisions, public.soc_cases, public.soc_case_alerts,
    public.soc_enrichment_lookups, public.soc_query_logs, public.soc_question_attempts,
    public.soc_report_submissions, public.soc_report_evaluations
  TO authenticated;

-- Seeds (and the scenario hash derived from them) are never granted.
GRANT SELECT (id, user_id, lab_id, mode, objectives_solved, hints_used, started_at, expires_at, completed_at, failed_at)
  ON public.lab_attempts TO authenticated;
GRANT SELECT (id, user_id, scenario_id, status, score_summary, started_at, submitted_at, updated_at,
              family_id, family_version, generator_version, difficulty)
  ON public.soc_attempts TO authenticated;

-- 4. Submitted reports are immutable for every role ---------------------------
CREATE OR REPLACE FUNCTION public.soc_block_submitted_report_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'submitted reports are immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.soc_block_submitted_report_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_soc_report_submissions_immutable ON public.soc_report_submissions;
CREATE TRIGGER trg_soc_report_submissions_immutable
    BEFORE UPDATE ON public.soc_report_submissions
    FOR EACH ROW EXECUTE FUNCTION public.soc_block_submitted_report_update();

-- 5. Erasure covers every learner table (S6) ----------------------------------
-- SECURITY DEFINER is required: it deletes rows learners cannot delete themselves. The caller
-- check below limits it to the account owner or the service role; search_path is pinned.
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND coalesce(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- AI grading (children first; most also cascade from submissions/users)
    DELETE FROM public.soc_ai_raw_outputs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_review_items WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_human_review_requests WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_grading_jobs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_criterion_grades WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_calibration_consent WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_usage_daily WHERE usage_key LIKE target_user_id::text || ':%';
    -- SOC track (decisions, cases and case alerts cascade from soc_attempts)
    DELETE FROM public.soc_report_evaluations WHERE user_id = target_user_id;
    DELETE FROM public.soc_report_submissions WHERE user_id = target_user_id;
    DELETE FROM public.soc_question_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_query_logs WHERE user_id = target_user_id;
    DELETE FROM public.soc_enrichment_lookups WHERE user_id = target_user_id;
    DELETE FROM public.soc_used_seeds WHERE user_id = target_user_id;
    DELETE FROM public.soc_attempts WHERE user_id = target_user_id;
    -- Learning effectiveness (P8)
    DELETE FROM public.review_events WHERE user_id = target_user_id;
    DELETE FROM public.review_items WHERE user_id = target_user_id;
    DELETE FROM public.learning_events WHERE user_id = target_user_id;
    DELETE FROM public.exam_reports WHERE user_id = target_user_id;
    -- Phase 2 core
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;
    DELETE FROM public.operators WHERE id = target_user_id;

    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;



-- =============================================================================
-- Migration: 20261015120000_phase_3_soc_exams.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE: SOC exam mode (Stage 1) - attempts, answers, outcome self-reports, accommodations
--
-- STATUS: NOT EXECUTED AGAINST A HOSTED DATABASE. Executed locally against PGlite with
-- Supabase-like roles by tests/db/access-hardening.test.ts and tests/db/soc-exams.test.ts.
--
-- ACCESS MODEL (same as the access-hardening migration):
--   - All writes come from the server through the service role. Learners have no INSERT,
--     UPDATE or DELETE on any table here, so they cannot write score, status, deadline,
--     budget or seed columns.
--   - soc_exam_attempts: learners SELECT their own rows, non-secret columns only (no seed).
--   - soc_exam_answers: learners SELECT their own answers.
--   - soc_exam_outcome_reports, soc_exam_accommodations: service role only (owner-only).
--   - One active exam per learner: partial unique index (second tab / double start).
--   - soc_start_exam_attempt(): atomic start (advisory lock + cooldown/cap checks + insert),
--     SECURITY INVOKER, executable by service_role only, search_path pinned.
--   - Answers cannot change after the exam is submitted (trigger, every role).
--
-- ADDITIVE + IDEMPOTENT: IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE.
--
-- ROLLBACK (drops exam data; only for an emergency):
--   DROP FUNCTION IF EXISTS public.soc_start_exam_attempt(uuid, text, int, text, uuid, text, text[], timestamptz, timestamptz, numeric, int, int, int);
--   DROP TABLE IF EXISTS public.soc_exam_answers, public.soc_exam_attempts,
--                        public.soc_exam_outcome_reports, public.soc_exam_accommodations;
--   delete_user_account(): re-apply its body from 20261014180000_phase_3_access_hardening.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.soc_exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('alert-queue','investigation','knowledge','mini-queue')),
    config_version INT NOT NULL,
    variant_id TEXT NOT NULL,
    soc_attempt_id UUID REFERENCES public.soc_attempts(id) ON DELETE SET NULL,
    seed TEXT NOT NULL,
    item_ids TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted')),
    submit_reason TEXT CHECK (submit_reason IN ('learner','deadline')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    time_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (time_multiplier >= 1 AND time_multiplier <= 3),
    submitted_at TIMESTAMPTZ,
    result JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS soc_exam_attempts_one_active
    ON public.soc_exam_attempts(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS soc_exam_attempts_user ON public.soc_exam_attempts(user_id, format, started_at DESC);
CREATE INDEX IF NOT EXISTS soc_exam_attempts_soc ON public.soc_exam_attempts(soc_attempt_id);

CREATE TABLE IF NOT EXISTS public.soc_exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_attempt_id UUID NOT NULL REFERENCES public.soc_exam_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    answer TEXT NOT NULL CHECK (char_length(answer) <= 4000),
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (exam_attempt_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.soc_exam_outcome_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cert_family TEXT NOT NULL CHECK (char_length(cert_family) <= 80),
    exam_date DATE NOT NULL,
    passed BOOLEAN NOT NULL,
    consent_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.soc_exam_accommodations (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    multiplier NUMERIC(4,2) NOT NULL CHECK (multiplier >= 1 AND multiplier <= 3),
    reason TEXT NOT NULL CHECK (char_length(reason) <= 300),
    set_by TEXT NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS ---------------------------------------------------------------------------
ALTER TABLE public.soc_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_exam_outcome_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_exam_accommodations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners read own exam attempts" ON public.soc_exam_attempts;
CREATE POLICY "Learners read own exam attempts"
    ON public.soc_exam_attempts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners read own exam answers" ON public.soc_exam_answers;
CREATE POLICY "Learners read own exam answers"
    ON public.soc_exam_answers FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
-- soc_exam_outcome_reports, soc_exam_accommodations: no learner policy at all.

REVOKE ALL ON public.soc_exam_attempts, public.soc_exam_answers,
              public.soc_exam_outcome_reports, public.soc_exam_accommodations
  FROM anon, authenticated;
GRANT SELECT ON public.soc_exam_answers TO authenticated;
-- The seed is never granted.
GRANT SELECT (id, user_id, format, config_version, variant_id, soc_attempt_id, item_ids, status,
              submit_reason, started_at, deadline_at, time_multiplier, submitted_at, result)
  ON public.soc_exam_attempts TO authenticated;

-- Answers are frozen once the exam is submitted (every role) -------------------
CREATE OR REPLACE FUNCTION public.soc_block_closed_exam_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT status FROM public.soc_exam_attempts WHERE id = NEW.exam_attempt_id) <> 'active' THEN
    RAISE EXCEPTION 'exam is closed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.soc_block_closed_exam_answer() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_soc_exam_answers_open_only ON public.soc_exam_answers;
CREATE TRIGGER trg_soc_exam_answers_open_only
    BEFORE INSERT OR UPDATE ON public.soc_exam_answers
    FOR EACH ROW EXECUTE FUNCTION public.soc_block_closed_exam_answer();

-- Atomic exam start ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soc_start_exam_attempt(
    p_user_id UUID, p_format TEXT, p_config_version INT, p_variant_id TEXT, p_id UUID, p_seed TEXT,
    p_item_ids TEXT[], p_started_at TIMESTAMPTZ, p_deadline_at TIMESTAMPTZ, p_time_multiplier NUMERIC,
    p_cooldown_minutes INT, p_max_attempts INT, p_window_days INT)
RETURNS SETOF public.soc_exam_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  last_done TIMESTAMPTZ;
  recent INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('soc_exam:' || p_user_id::text));
  IF EXISTS (SELECT 1 FROM public.soc_exam_attempts WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'exam is active';
  END IF;
  SELECT max(submitted_at) INTO last_done FROM public.soc_exam_attempts
   WHERE user_id = p_user_id AND format = p_format AND submitted_at IS NOT NULL;
  IF last_done IS NOT NULL AND p_started_at - last_done < make_interval(mins => p_cooldown_minutes) THEN
    RAISE EXCEPTION 'exam is cooling down';
  END IF;
  SELECT count(*) INTO recent FROM public.soc_exam_attempts
   WHERE user_id = p_user_id AND format = p_format AND started_at >= p_started_at - make_interval(days => p_window_days);
  IF recent >= p_max_attempts THEN
    RAISE EXCEPTION 'exam retake limit reached';
  END IF;
  RETURN QUERY
    INSERT INTO public.soc_exam_attempts(id, user_id, format, config_version, variant_id, seed, item_ids,
                                         status, started_at, deadline_at, time_multiplier)
    VALUES (p_id, p_user_id, p_format, p_config_version, p_variant_id, p_seed, p_item_ids,
            'active', p_started_at, p_deadline_at, p_time_multiplier)
    RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.soc_start_exam_attempt(UUID, TEXT, INT, TEXT, UUID, TEXT, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, INT, INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soc_start_exam_attempt(UUID, TEXT, INT, TEXT, UUID, TEXT, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, INT, INT, INT)
  TO service_role;

-- Erasure covers the new tables -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND coalesce(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- SOC exams (Stage 1)
    DELETE FROM public.soc_exam_answers WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_outcome_reports WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_accommodations WHERE user_id = target_user_id;
    -- AI grading (children first; most also cascade from submissions/users)
    DELETE FROM public.soc_ai_raw_outputs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_review_items WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_human_review_requests WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_grading_jobs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_criterion_grades WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_calibration_consent WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_usage_daily WHERE usage_key LIKE target_user_id::text || ':%';
    -- SOC track (decisions, cases and case alerts cascade from soc_attempts)
    DELETE FROM public.soc_report_evaluations WHERE user_id = target_user_id;
    DELETE FROM public.soc_report_submissions WHERE user_id = target_user_id;
    DELETE FROM public.soc_question_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_query_logs WHERE user_id = target_user_id;
    DELETE FROM public.soc_enrichment_lookups WHERE user_id = target_user_id;
    DELETE FROM public.soc_used_seeds WHERE user_id = target_user_id;
    DELETE FROM public.soc_attempts WHERE user_id = target_user_id;
    -- Learning effectiveness (P8)
    DELETE FROM public.review_events WHERE user_id = target_user_id;
    DELETE FROM public.review_items WHERE user_id = target_user_id;
    DELETE FROM public.learning_events WHERE user_id = target_user_id;
    DELETE FROM public.exam_reports WHERE user_id = target_user_id;
    -- Phase 2 core
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;
    DELETE FROM public.operators WHERE id = target_user_id;

    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;



-- =============================================================================
-- Migration: 20261015180000_phase_3_soc_l1_audit_fixes.sql
-- =============================================================================
-- Phase 3 Â· L1 audit fixes (docs/ops/l1-audit.md L1-A-02, L1-A-04). ADDITIVE: privileges only.
--
-- Learners read their SOC rows directly with their own token (PostgREST), so any column granted to
-- `authenticated` is visible during an exam. The app server reads these tables with the service
-- role and does not need these grants. Removed from the learner grant:
--   soc_question_attempts.is_correct  correctness of a saved answer (an oracle during an exam)
--   soc_attempts.family_id            names the scenario family (and so the incident type)
--   soc_exam_attempts.variant_id      the same, for the exam record
--   soc_exam_attempts.item_ids        knowledge item ids, which name their topic or answer
--
-- ROLLBACK (restores the previous learner grants):
--   GRANT SELECT ON public.soc_question_attempts TO authenticated;
--   GRANT SELECT (family_id) ON public.soc_attempts TO authenticated;
--   GRANT SELECT (variant_id, item_ids) ON public.soc_exam_attempts TO authenticated;

REVOKE SELECT ON public.soc_question_attempts FROM authenticated;
GRANT SELECT (id, attempt_id, user_id, question_id, submitted_answer, attempts_used, hints_used, created_at)
  ON public.soc_question_attempts TO authenticated;

REVOKE SELECT ON public.soc_attempts FROM authenticated;
GRANT SELECT (id, user_id, scenario_id, status, score_summary, started_at, submitted_at, updated_at,
              family_version, generator_version, difficulty)
  ON public.soc_attempts TO authenticated;

REVOKE SELECT ON public.soc_exam_attempts FROM authenticated;
GRANT SELECT (id, user_id, format, config_version, soc_attempt_id, status, submit_reason, started_at,
              deadline_at, time_multiplier, submitted_at, result)
  ON public.soc_exam_attempts TO authenticated;



-- =============================================================================
-- Migration: 20261016120000_beta_hardening.sql
-- =============================================================================
-- Beta hardening (invite-only closed beta). ADDITIVE: new tables and functions only, plus
-- delete_user_account re-created with the new tables added (same signature, same security mode).
-- NOT EXECUTED AGAINST ANY HOSTED DATABASE. Executed on PGlite in tests/db.
--
-- 1. rate_limit_buckets + rate_limit_hit(): serverless-safe fixed-window rate limits (service only).
--    Keys are SHA-256 hashes computed by the app, so no IP or user id is stored in clear.
-- 2. handler_usage_global + handler_usage_add(): atomic Handler metering (per learner in the
--    existing handler_usage table, plus an all-learner daily row for the spend ceiling).
-- 3. beta_invites + beta_invite_redemptions + beta_redeem_invite(): hashed, limited-use invite
--    codes with expiry and revocation; redemption is atomic.
-- 4. beta_notice_acks: timestamped acknowledgement of the beta notice (own rows readable).
-- 5. learner_feedback: in-app feedback and "report a problem" (own rows readable; written by the
--    server only).
--
-- ROLLBACK (manual; drops beta data):
--   DROP FUNCTION IF EXISTS public.beta_redeem_invite(TEXT, UUID, TIMESTAMPTZ);
--   DROP FUNCTION IF EXISTS public.handler_usage_add(UUID, DATE, INTEGER, INTEGER);
--   DROP FUNCTION IF EXISTS public.rate_limit_hit(TEXT, INTEGER, INTEGER);
--   DROP FUNCTION IF EXISTS public.rate_limit_cleanup();
--   DROP TABLE IF EXISTS public.learner_feedback, public.beta_notice_acks,
--     public.beta_invite_redemptions, public.beta_invites, public.handler_usage_global,
--     public.rate_limit_buckets;
--   then re-apply delete_user_account from 20261015120000_phase_3_soc_exams.sql.

-- 1. Rate limits ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key TEXT NOT NULL CHECK (char_length(bucket_key) = 64),
    window_start TIMESTAMPTZ NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expiry ON public.rate_limit_buckets (expires_at);
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;

-- One atomic statement per hit: concurrent requests on any number of instances see one counter.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key TEXT, p_max INTEGER, p_window_ms INTEGER)
RETURNS TABLE (allowed BOOLEAN, hits INTEGER, retry_after_ms INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_window_start TIMESTAMPTZ;
    v_window_end TIMESTAMPTZ;
    v_hits INTEGER;
BEGIN
    IF p_max < 1 OR p_window_ms < 1 OR p_window_ms > 86400000 THEN
        RAISE EXCEPTION 'invalid rate limit';
    END IF;
    v_window_start := to_timestamp(floor(extract(epoch FROM v_now) * 1000 / p_window_ms) * p_window_ms / 1000.0);
    v_window_end := v_window_start + make_interval(secs => p_window_ms / 1000.0);
    INSERT INTO public.rate_limit_buckets AS b (bucket_key, window_start, hits, expires_at)
    VALUES (p_key, v_window_start, 1, v_window_end)
    ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = b.hits + 1
    RETURNING b.hits INTO v_hits;
    allowed := v_hits <= p_max;
    hits := v_hits;
    retry_after_ms := CASE WHEN v_hits <= p_max THEN 0
        ELSE greatest(0, ceil(extract(epoch FROM (v_window_end - v_now)) * 1000))::INTEGER END;
    RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE v_deleted INTEGER;
BEGIN
    DELETE FROM public.rate_limit_buckets WHERE expires_at < now() - interval '1 hour';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_cleanup() TO service_role;

-- 2. Handler metering -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.handler_usage_global (
    date DATE PRIMARY KEY,
    requests_count INTEGER NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
    input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.handler_usage_global ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.handler_usage_global FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handler_usage_add(p_user_id UUID, p_date DATE, p_input INTEGER, p_output INTEGER)
RETURNS TABLE (requests_count INTEGER, input_tokens INTEGER, output_tokens INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_input < 0 OR p_output < 0 THEN RAISE EXCEPTION 'invalid usage'; END IF;
    INSERT INTO public.handler_usage_global AS g (date, requests_count, input_tokens, output_tokens, last_request_at)
    VALUES (p_date, 1, p_input, p_output, now())
    ON CONFLICT (date) DO UPDATE SET requests_count = g.requests_count + 1,
        input_tokens = g.input_tokens + p_input, output_tokens = g.output_tokens + p_output, last_request_at = now();
    RETURN QUERY
    INSERT INTO public.handler_usage AS u (user_id, date, requests_count, input_tokens, output_tokens, last_request_at)
    VALUES (p_user_id, p_date, 1, p_input, p_output, now())
    ON CONFLICT (user_id, date) DO UPDATE SET requests_count = u.requests_count + 1,
        input_tokens = u.input_tokens + p_input, output_tokens = u.output_tokens + p_output, last_request_at = now()
    RETURNING u.requests_count, u.input_tokens, u.output_tokens;
END;
$$;
REVOKE ALL ON FUNCTION public.handler_usage_add(UUID, DATE, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handler_usage_add(UUID, DATE, INTEGER, INTEGER) TO service_role;

-- 3. Beta invites -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash TEXT NOT NULL UNIQUE CHECK (char_length(code_hash) = 64),
    label TEXT NOT NULL DEFAULT '' CHECK (char_length(label) <= 120),
    max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 1000),
    uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_by TEXT NOT NULL CHECK (char_length(created_by) BETWEEN 1 AND 64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (uses <= max_uses)
);
ALTER TABLE public.beta_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_invites FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.beta_invite_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id UUID NOT NULL REFERENCES public.beta_invites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.beta_invite_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_invite_redemptions FROM anon, authenticated;
GRANT SELECT (id, user_id, redeemed_at) ON public.beta_invite_redemptions TO authenticated;
DROP POLICY IF EXISTS "Learners read own redemption" ON public.beta_invite_redemptions;
CREATE POLICY "Learners read own redemption" ON public.beta_invite_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Atomic: lock the invite row, check revoked / expired / used up, count the use, record it.
-- Returns false for every failure reason alike (no enumeration).
CREATE OR REPLACE FUNCTION public.beta_redeem_invite(p_code_hash TEXT, p_user_id UUID, p_now TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE v_invite public.beta_invites%ROWTYPE;
BEGIN
    IF EXISTS (SELECT 1 FROM public.beta_invite_redemptions WHERE user_id = p_user_id) THEN
        RETURN TRUE; -- already admitted: idempotent
    END IF;
    SELECT * INTO v_invite FROM public.beta_invites WHERE code_hash = p_code_hash FOR UPDATE;
    IF NOT FOUND OR v_invite.revoked_at IS NOT NULL OR v_invite.expires_at <= p_now OR v_invite.uses >= v_invite.max_uses THEN
        RETURN FALSE;
    END IF;
    UPDATE public.beta_invites SET uses = uses + 1 WHERE id = v_invite.id;
    INSERT INTO public.beta_invite_redemptions (invite_id, user_id, redeemed_at) VALUES (v_invite.id, p_user_id, p_now);
    RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.beta_redeem_invite(TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.beta_redeem_invite(TEXT, UUID, TIMESTAMPTZ) TO service_role;

-- 4. Beta notice acknowledgements -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_notice_acks (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notice_version TEXT NOT NULL CHECK (char_length(notice_version) BETWEEN 1 AND 32),
    acked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, notice_version)
);
ALTER TABLE public.beta_notice_acks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_notice_acks FROM anon, authenticated;
GRANT SELECT ON public.beta_notice_acks TO authenticated;
DROP POLICY IF EXISTS "Learners read own beta notice acks" ON public.beta_notice_acks;
CREATE POLICY "Learners read own beta notice acks" ON public.beta_notice_acks FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 5. Learner feedback ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learner_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('general', 'lesson_check', 'exam_question', 'scenario')),
    content_id TEXT NOT NULL DEFAULT '' CHECK (char_length(content_id) <= 160),
    route TEXT NOT NULL DEFAULT '' CHECK (char_length(route) <= 200),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    request_id TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 8 AND 64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learner_feedback_content ON public.learner_feedback (kind, content_id, created_at);
ALTER TABLE public.learner_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learner_feedback FROM anon, authenticated;
GRANT SELECT ON public.learner_feedback TO authenticated;
DROP POLICY IF EXISTS "Learners read own feedback" ON public.learner_feedback;
CREATE POLICY "Learners read own feedback" ON public.learner_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 6. Account deletion covers the new tables ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND coalesce(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- Beta (this migration). Invite rows stay (they belong to the owner); the use count is kept.
    DELETE FROM public.learner_feedback WHERE user_id = target_user_id;
    DELETE FROM public.beta_notice_acks WHERE user_id = target_user_id;
    DELETE FROM public.beta_invite_redemptions WHERE user_id = target_user_id;
    -- SOC exams (Stage 1)
    DELETE FROM public.soc_exam_answers WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_outcome_reports WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_accommodations WHERE user_id = target_user_id;
    -- AI grading (children first; most also cascade from submissions/users)
    DELETE FROM public.soc_ai_raw_outputs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_review_items WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_human_review_requests WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_grading_jobs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_criterion_grades WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_calibration_consent WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_usage_daily WHERE usage_key LIKE target_user_id::text || ':%';
    -- SOC track (decisions, cases and case alerts cascade from soc_attempts)
    DELETE FROM public.soc_report_evaluations WHERE user_id = target_user_id;
    DELETE FROM public.soc_report_submissions WHERE user_id = target_user_id;
    DELETE FROM public.soc_question_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_query_logs WHERE user_id = target_user_id;
    DELETE FROM public.soc_enrichment_lookups WHERE user_id = target_user_id;
    DELETE FROM public.soc_used_seeds WHERE user_id = target_user_id;
    DELETE FROM public.soc_attempts WHERE user_id = target_user_id;
    -- Learning effectiveness (P8)
    DELETE FROM public.review_events WHERE user_id = target_user_id;
    DELETE FROM public.review_items WHERE user_id = target_user_id;
    DELETE FROM public.learning_events WHERE user_id = target_user_id;
    DELETE FROM public.exam_reports WHERE user_id = target_user_id;
    -- Phase 2 core
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;
    DELETE FROM public.operators WHERE id = target_user_id;

    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;



-- =============================================================================
-- Migration: 20261016180000_soc_l2_exams.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE: SOC L2 exam formats (investigation-l2, detection-rule, knowledge-l2)
--
-- STATUS: NOT EXECUTED AGAINST A HOSTED DATABASE. Executed locally against PGlite with
-- Supabase-like roles in test suite.
--
-- ACCESS MODEL:
--   - All writes come from the server through the service role.
--   - soc_detection_rules: learners SELECT their own rules only.
--   - soc_exam_attempts: format constraint expanded to include L2 formats.
--   - delete_user_account(): re-created to remove soc_detection_rules rows.
--
-- ADDITIVE + IDEMPOTENT.
--
-- ROLLBACK (manual; only for an emergency):
--   ALTER TABLE public.soc_exam_attempts DROP CONSTRAINT IF EXISTS soc_exam_attempts_format_check;
--   ALTER TABLE public.soc_exam_attempts ADD CONSTRAINT soc_exam_attempts_format_check
--     CHECK (format IN ('alert-queue','investigation','knowledge','mini-queue'));
--   DROP TABLE IF EXISTS public.soc_detection_rules;
--   delete_user_account(): re-apply its body from 20261016120000_beta_hardening.sql.
-- =============================================================================

-- 1. Expand soc_exam_attempts format check constraint
ALTER TABLE public.soc_exam_attempts DROP CONSTRAINT IF EXISTS soc_exam_attempts_format_check;
ALTER TABLE public.soc_exam_attempts ADD CONSTRAINT soc_exam_attempts_format_check
    CHECK (format IN (
        'alert-queue',
        'investigation',
        'knowledge',
        'mini-queue',
        'investigation-l2',
        'detection-rule',
        'knowledge-l2'
    ));

-- 2. Detection rules table (for rule challenges and authored detection engineering)
CREATE TABLE IF NOT EXISTS public.soc_detection_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_attempt_id UUID REFERENCES public.soc_exam_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    tactic TEXT NOT NULL DEFAULT '' CHECK (char_length(tactic) <= 64),
    technique TEXT NOT NULL DEFAULT '' CHECK (char_length(technique) <= 64),
    query TEXT NOT NULL CHECK (char_length(query) BETWEEN 1 AND 4000),
    test_results JSONB,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soc_detection_rules_user ON public.soc_detection_rules(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc_detection_rules_exam ON public.soc_detection_rules(exam_attempt_id);

ALTER TABLE public.soc_detection_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soc_detection_rules FROM anon, authenticated;
GRANT SELECT ON public.soc_detection_rules TO authenticated;

DROP POLICY IF EXISTS "Learners read own detection rules" ON public.soc_detection_rules;
CREATE POLICY "Learners read own detection rules" ON public.soc_detection_rules
    FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT ALL ON public.soc_detection_rules TO service_role;

-- 3. Account deletion covers detection rules
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND coalesce(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- L2 detection rules
    DELETE FROM public.soc_detection_rules WHERE user_id = target_user_id;
    -- Beta
    DELETE FROM public.learner_feedback WHERE user_id = target_user_id;
    DELETE FROM public.beta_notice_acks WHERE user_id = target_user_id;
    DELETE FROM public.beta_invite_redemptions WHERE user_id = target_user_id;
    -- SOC exams
    DELETE FROM public.soc_exam_answers WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_outcome_reports WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_accommodations WHERE user_id = target_user_id;
    -- AI grading
    DELETE FROM public.soc_ai_raw_outputs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_review_items WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_human_review_requests WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_grading_jobs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_criterion_grades WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_calibration_consent WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_usage_daily WHERE usage_key LIKE target_user_id::text || ':%';
    -- SOC track
    DELETE FROM public.soc_report_evaluations WHERE user_id = target_user_id;
    DELETE FROM public.soc_report_submissions WHERE user_id = target_user_id;
    DELETE FROM public.soc_question_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_query_logs WHERE user_id = target_user_id;
    DELETE FROM public.soc_enrichment_lookups WHERE user_id = target_user_id;
    DELETE FROM public.soc_used_seeds WHERE user_id = target_user_id;
    DELETE FROM public.soc_attempts WHERE user_id = target_user_id;
    -- Learning effectiveness
    DELETE FROM public.review_events WHERE user_id = target_user_id;
    DELETE FROM public.review_items WHERE user_id = target_user_id;
    DELETE FROM public.learning_events WHERE user_id = target_user_id;
    DELETE FROM public.exam_reports WHERE user_id = target_user_id;
    -- Phase 2 core
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;
    DELETE FROM public.operators WHERE id = target_user_id;

    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;



-- =============================================================================
-- Migration: 20261017100000_certificates_and_verification.sql
-- =============================================================================
-- 20261017100000_certificates_and_verification.sql
-- CyberBLADE Completion Certificates and Public Verification Registry
-- Additive migration implementing certificates table, RLS, public verification RPC, and cascade erasure.

-- 1. Certificates Table
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    level TEXT NOT NULL,
    name_as_chosen TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    revocation_reason TEXT DEFAULT NULL,
    score_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT certificates_user_track_level_unique UNIQUE (user_id, track_id, level)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_credential_id ON public.certificates(credential_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Revoke all table-level access from anon and public
REVOKE ALL ON TABLE public.certificates FROM PUBLIC, anon;

-- Authenticated learners can ONLY read their own certificates
GRANT SELECT ON TABLE public.certificates TO authenticated;
GRANT ALL ON TABLE public.certificates TO service_role;

DROP POLICY IF EXISTS "certificates_select_owner" ON public.certificates;
CREATE POLICY "certificates_select_owner" ON public.certificates
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 4. Public Verification RPC
-- Public read ONLY via a verify RPC that returns name-as-chosen, track, level, issue date, status â€” never email or internal ids
CREATE OR REPLACE FUNCTION public.verify_certificate(p_credential_id TEXT)
RETURNS TABLE (
    credential_id TEXT,
    name_as_chosen TEXT,
    track_id TEXT,
    level TEXT,
    issued_at TIMESTAMPTZ,
    status TEXT,
    revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.credential_id,
        c.name_as_chosen,
        c.track_id,
        c.level,
        c.issued_at,
        CASE
            WHEN c.revoked_at IS NOT NULL THEN 'revoked'
            ELSE 'valid'
        END AS status,
        c.revoked_at
    FROM public.certificates c
    WHERE c.credential_id = p_credential_id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated, service_role;

-- 5. Revocation RPC (Admin / Service Role only, SECURITY INVOKER with pinned search_path)
CREATE OR REPLACE FUNCTION public.revoke_certificate(p_credential_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.certificates
    SET revoked_at = COALESCE(revoked_at, now()),
        revocation_reason = p_reason
    WHERE credential_id = p_credential_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_certificate(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_certificate(TEXT, TEXT) TO service_role;

-- 6. Update delete_user_account for cascade erasure (Standing Rule 6 / GDPR)
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND coalesce(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- Certificates erasure
    DELETE FROM public.certificates WHERE user_id = target_user_id;

    -- L2 detection rules
    DELETE FROM public.soc_detection_rules WHERE user_id = target_user_id;
    -- Beta
    DELETE FROM public.learner_feedback WHERE user_id = target_user_id;
    DELETE FROM public.beta_notice_acks WHERE user_id = target_user_id;
    DELETE FROM public.beta_invite_redemptions WHERE user_id = target_user_id;
    -- SOC exams
    DELETE FROM public.soc_exam_answers WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_outcome_reports WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_accommodations WHERE user_id = target_user_id;
    -- AI grading
    DELETE FROM public.soc_ai_raw_outputs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_review_items WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_human_review_requests WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_grading_jobs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_criterion_grades WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_calibration_consent WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_usage_daily WHERE usage_key LIKE target_user_id::text || ':%';
    -- SOC track
    DELETE FROM public.soc_report_evaluations WHERE user_id = target_user_id;
    DELETE FROM public.soc_report_submissions WHERE user_id = target_user_id;
    DELETE FROM public.soc_question_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_query_logs WHERE user_id = target_user_id;
    DELETE FROM public.soc_enrichment_lookups WHERE user_id = target_user_id;
    DELETE FROM public.soc_used_seeds WHERE user_id = target_user_id;
    DELETE FROM public.soc_attempts WHERE user_id = target_user_id;
    -- Learning effectiveness
    DELETE FROM public.review_events WHERE user_id = target_user_id;
    DELETE FROM public.review_items WHERE user_id = target_user_id;
    DELETE FROM public.learning_events WHERE user_id = target_user_id;
    DELETE FROM public.exam_reports WHERE user_id = target_user_id;
    -- Phase 2 core
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;
    DELETE FROM public.operators WHERE id = target_user_id;

    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;



-- =============================================================================
-- Migration: 20261017120000_pentest_l1_exams.sql
-- =============================================================================
-- =============================================================================
-- CyberBLADE: Pentest L1 exam mode (eJPT style practical assessment)
-- Tables: pentest_exam_attempts, pentest_exam_answers
-- Atomic start RPC, RLS with column restriction (seed never granted), frozen answer trigger,
-- and cascade erasure in delete_user_account.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pentest_exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('practical','mock')),
    config_version INT NOT NULL,
    scenario_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    item_ids TEXT[] NOT NULL DEFAULT '{}',
    scenario_state JSONB,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted')),
    submit_reason TEXT CHECK (submit_reason IN ('learner','deadline')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    time_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (time_multiplier >= 1 AND time_multiplier <= 3),
    submitted_at TIMESTAMPTZ,
    result JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS pentest_exam_attempts_one_active
    ON public.pentest_exam_attempts(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS pentest_exam_attempts_user
    ON public.pentest_exam_attempts(user_id, format, started_at DESC);

CREATE TABLE IF NOT EXISTS public.pentest_exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_attempt_id UUID NOT NULL REFERENCES public.pentest_exam_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    answer TEXT NOT NULL CHECK (char_length(answer) <= 4000),
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (exam_attempt_id, item_id)
);

-- RLS ---------------------------------------------------------------------------
ALTER TABLE public.pentest_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pentest_exam_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners read own pentest exam attempts" ON public.pentest_exam_attempts;
CREATE POLICY "Learners read own pentest exam attempts"
    ON public.pentest_exam_attempts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners read own pentest exam answers" ON public.pentest_exam_answers;
CREATE POLICY "Learners read own pentest exam answers"
    ON public.pentest_exam_answers FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

REVOKE ALL ON public.pentest_exam_attempts, public.pentest_exam_answers
  FROM anon, authenticated;
GRANT SELECT ON public.pentest_exam_answers TO authenticated;

-- The seed column is NEVER granted to learners
GRANT SELECT (id, user_id, format, config_version, scenario_id, item_ids, scenario_state, status,
              submit_reason, started_at, deadline_at, time_multiplier, submitted_at, result)
  ON public.pentest_exam_attempts TO authenticated;

GRANT ALL ON public.pentest_exam_attempts, public.pentest_exam_answers TO service_role;

-- Answers are frozen once the exam is submitted (every role) -------------------
CREATE OR REPLACE FUNCTION public.pentest_block_closed_exam_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT status FROM public.pentest_exam_attempts WHERE id = NEW.exam_attempt_id) <> 'active' THEN
    RAISE EXCEPTION 'exam is closed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pentest_block_closed_exam_answer() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pentest_exam_answers_open_only ON public.pentest_exam_answers;
CREATE TRIGGER trg_pentest_exam_answers_open_only
    BEFORE INSERT OR UPDATE ON public.pentest_exam_answers
    FOR EACH ROW EXECUTE FUNCTION public.pentest_block_closed_exam_answer();

-- Atomic exam start RPC -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pentest_start_exam_attempt(
    p_user_id UUID, p_format TEXT, p_config_version INT, p_scenario_id TEXT, p_id UUID, p_seed TEXT,
    p_item_ids TEXT[], p_scenario_state JSONB, p_started_at TIMESTAMPTZ, p_deadline_at TIMESTAMPTZ, p_time_multiplier NUMERIC,
    p_cooldown_minutes INT, p_max_attempts INT, p_window_days INT)
RETURNS SETOF public.pentest_exam_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  last_done TIMESTAMPTZ;
  recent INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('pentest_exam:' || p_user_id::text));
  IF EXISTS (SELECT 1 FROM public.pentest_exam_attempts WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'exam is active';
  END IF;
  SELECT max(submitted_at) INTO last_done FROM public.pentest_exam_attempts
   WHERE user_id = p_user_id AND format = p_format AND submitted_at IS NOT NULL;
  IF last_done IS NOT NULL AND p_started_at - last_done < make_interval(mins => p_cooldown_minutes) THEN
    RAISE EXCEPTION 'exam is cooling down';
  END IF;
  SELECT count(*) INTO recent FROM public.pentest_exam_attempts
   WHERE user_id = p_user_id AND format = p_format AND started_at >= p_started_at - make_interval(days => p_window_days);
  IF recent >= p_max_attempts THEN
    RAISE EXCEPTION 'exam retake limit reached';
  END IF;
  RETURN QUERY
    INSERT INTO public.pentest_exam_attempts(id, user_id, format, config_version, scenario_id, seed, item_ids,
                                             scenario_state, status, started_at, deadline_at, time_multiplier)
    VALUES (p_id, p_user_id, p_format, p_config_version, p_scenario_id, p_seed, p_item_ids,
            p_scenario_state, 'active', p_started_at, p_deadline_at, p_time_multiplier)
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.pentest_start_exam_attempt(UUID, TEXT, INT, TEXT, UUID, TEXT, TEXT[], JSONB, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, INT, INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pentest_start_exam_attempt(UUID, TEXT, INT, TEXT, UUID, TEXT, TEXT[], JSONB, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, INT, INT, INT)
  TO service_role;

-- Cascade erasure in delete_user_account (Standing Rule 6 / GDPR) -------------
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF (auth.uid() IS NULL OR auth.uid() <> target_user_id) AND coalesce(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
    END IF;

    -- Pentest exams
    DELETE FROM public.pentest_exam_answers WHERE user_id = target_user_id;
    DELETE FROM public.pentest_exam_attempts WHERE user_id = target_user_id;

    -- Certificates
    DELETE FROM public.certificates WHERE user_id = target_user_id;

    -- L2 detection rules
    DELETE FROM public.soc_detection_rules WHERE user_id = target_user_id;
    -- Beta
    DELETE FROM public.learner_feedback WHERE user_id = target_user_id;
    DELETE FROM public.beta_notice_acks WHERE user_id = target_user_id;
    DELETE FROM public.beta_invite_redemptions WHERE user_id = target_user_id;
    -- SOC exams
    DELETE FROM public.soc_exam_answers WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_outcome_reports WHERE user_id = target_user_id;
    DELETE FROM public.soc_exam_accommodations WHERE user_id = target_user_id;
    -- AI grading
    DELETE FROM public.soc_ai_raw_outputs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_review_items WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_human_review_requests WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_grading_jobs WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_criterion_grades WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_calibration_consent WHERE user_id = target_user_id;
    DELETE FROM public.soc_ai_usage_daily WHERE usage_key LIKE target_user_id::text || ':%';
    -- SOC track
    DELETE FROM public.soc_report_evaluations WHERE user_id = target_user_id;
    DELETE FROM public.soc_report_submissions WHERE user_id = target_user_id;
    DELETE FROM public.soc_question_attempts WHERE user_id = target_user_id;
    DELETE FROM public.soc_query_logs WHERE user_id = target_user_id;
    DELETE FROM public.soc_enrichment_lookups WHERE user_id = target_user_id;
    DELETE FROM public.soc_used_seeds WHERE user_id = target_user_id;
    DELETE FROM public.soc_attempts WHERE user_id = target_user_id;
    -- Learning effectiveness
    DELETE FROM public.review_events WHERE user_id = target_user_id;
    DELETE FROM public.review_items WHERE user_id = target_user_id;
    DELETE FROM public.learning_events WHERE user_id = target_user_id;
    DELETE FROM public.exam_reports WHERE user_id = target_user_id;
    -- Core
    DELETE FROM public.rank_challenges WHERE user_id = target_user_id;
    DELETE FROM public.lab_attempts WHERE user_id = target_user_id;
    DELETE FROM public.lesson_progress WHERE user_id = target_user_id;
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    DELETE FROM public.handler_usage WHERE user_id = target_user_id;
    DELETE FROM public.attempt_lockouts WHERE user_id = target_user_id;
    DELETE FROM public.operators WHERE id = target_user_id;

    INSERT INTO public.audit_events (user_id, event_type, severity, metadata)
    VALUES (NULL, 'account.deleted', 'info', jsonb_build_object('anonymized_id', target_user_id));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;




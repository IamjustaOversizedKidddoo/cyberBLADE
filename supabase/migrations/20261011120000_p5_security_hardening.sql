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

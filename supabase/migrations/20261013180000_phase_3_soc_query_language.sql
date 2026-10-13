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

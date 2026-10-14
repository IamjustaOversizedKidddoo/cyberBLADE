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

-- =============================================================================
-- CyberBLADE Platform: SOC Incident Report Submissions & Evaluations (Phase 3 Prompt 6)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Creates `public.soc_report_submissions` — append-only draft/submission log:
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
-- 2. Creates `public.soc_report_evaluations` — one row per graded submission:
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

-- One draft per (attempt, template) — on conflict update in place
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

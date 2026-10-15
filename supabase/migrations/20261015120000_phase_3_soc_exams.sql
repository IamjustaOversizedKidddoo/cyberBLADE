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

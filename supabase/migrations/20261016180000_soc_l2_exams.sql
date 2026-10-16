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

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
-- Public read ONLY via a verify RPC that returns name-as-chosen, track, level, issue date, status — never email or internal ids
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

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

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

-- Phase 3 · L1 audit fixes (docs/ops/l1-audit.md L1-A-02, L1-A-04). ADDITIVE: privileges only.
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

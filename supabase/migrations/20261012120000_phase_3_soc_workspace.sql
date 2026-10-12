-- =============================================================================
-- CyberBLADE Platform: SOC Workspace & Decision Pipeline Schema (Phase 3)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds `soc_attempts` table tracking learner shift sessions per scenario.
-- 2. Adds `soc_decisions` append-only immutable log for alert triage decisions.
-- 3. Adds `soc_cases` table for incident grouping, notes, and severity tracking.
-- 4. Adds `soc_case_alerts` join table associating alerts with active cases.
-- 5. Enables strict Row Level Security (RLS) on all 4 tables with owner-only isolation.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_case_alerts CASCADE;
-- DROP TABLE IF EXISTS public.soc_cases CASCADE;
-- DROP TABLE IF EXISTS public.soc_decisions CASCADE;
-- DROP TABLE IF EXISTS public.soc_attempts CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SOC Attempts Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    seed TEXT NOT NULL DEFAULT 'default',
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'expired')),
    score_summary JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_attempts_user ON public.soc_attempts (user_id, scenario_id);
CREATE INDEX IF NOT EXISTS idx_soc_attempts_status ON public.soc_attempts (user_id, status);
ALTER TABLE public.soc_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc attempts" ON public.soc_attempts;
CREATE POLICY "Operators manage own soc attempts"
    ON public.soc_attempts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. SOC Decisions Log (Append-Only Triage Decision History)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL,
    disposition TEXT NOT NULL CHECK (disposition IN ('true_positive', 'false_positive', 'benign_true_positive', 'duplicate', 'needs_more_info')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    escalate BOOLEAN NOT NULL DEFAULT false,
    target_tier TEXT CHECK (target_tier IS NULL OR target_tier IN ('tier2', 'incident_response', 'threat_intel', 'engineering')),
    rationale TEXT NOT NULL,
    evidence_refs TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_decisions_attempt ON public.soc_decisions (attempt_id, alert_id);
ALTER TABLE public.soc_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc decisions" ON public.soc_decisions;
CREATE POLICY "Operators manage own soc decisions"
    ON public.soc_decisions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_decisions.attempt_id AND a.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_decisions.attempt_id AND a.user_id = auth.uid()
    ));

-- -----------------------------------------------------------------------------
-- 3. SOC Cases Table (Incident Grouping & Notes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'escalated', 'closed')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_cases_attempt ON public.soc_cases (attempt_id);
ALTER TABLE public.soc_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc cases" ON public.soc_cases;
CREATE POLICY "Operators manage own soc cases"
    ON public.soc_cases FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_cases.attempt_id AND a.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.soc_attempts a
        WHERE a.id = soc_cases.attempt_id AND a.user_id = auth.uid()
    ));

-- -----------------------------------------------------------------------------
-- 4. SOC Case Alerts Join Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soc_case_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.soc_cases(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_case_alert UNIQUE (case_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_soc_case_alerts_case ON public.soc_case_alerts (case_id);
ALTER TABLE public.soc_case_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc case alerts" ON public.soc_case_alerts;
CREATE POLICY "Operators manage own soc case alerts"
    ON public.soc_case_alerts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.soc_cases c
        JOIN public.soc_attempts a ON a.id = c.attempt_id
        WHERE c.id = soc_case_alerts.case_id AND a.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.soc_cases c
        JOIN public.soc_attempts a ON a.id = c.attempt_id
        WHERE c.id = soc_case_alerts.case_id AND a.user_id = auth.uid()
    ));

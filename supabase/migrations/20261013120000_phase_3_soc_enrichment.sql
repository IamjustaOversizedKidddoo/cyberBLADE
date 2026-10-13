-- =============================================================================
-- CyberBLADE Platform: SOC Enrichment and Evidence Layer Schema (Phase 3 Prompt 4)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Creates `public.soc_enrichment_lookups` append-only audit table to log every
--    simulated intelligence lookup requested by a learner:
--    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE
--    - user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
--    - tool TEXT NOT NULL (e.g. 'reputation', 'whois', 'pdns', 'email_headers', etc.)
--    - entity_type TEXT NOT NULL ('ip', 'domain', 'url', 'hash', 'email', 'user', 'host')
--    - entity_value TEXT NOT NULL (canonicalized identifier queried)
--    - response_hash TEXT NOT NULL (SHA-256 hash of deterministic payload for integrity)
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- 2. Enables strict Row Level Security (RLS) on `soc_enrichment_lookups` (owner-only).
-- 3. Adds indexing for rapid per-attempt audit timeline replay and rate limiting.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_enrichment_lookups CASCADE;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.soc_enrichment_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    response_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_enrichment_lookups_attempt 
    ON public.soc_enrichment_lookups (attempt_id, created_at);

CREATE INDEX IF NOT EXISTS idx_soc_enrichment_lookups_user_tool 
    ON public.soc_enrichment_lookups (user_id, tool, created_at);

ALTER TABLE public.soc_enrichment_lookups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners insert own enrichment lookups" ON public.soc_enrichment_lookups;
CREATE POLICY "Learners insert own enrichment lookups"
    ON public.soc_enrichment_lookups FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learners view own enrichment lookups" ON public.soc_enrichment_lookups;
CREATE POLICY "Learners view own enrichment lookups"
    ON public.soc_enrichment_lookups FOR SELECT
    USING (auth.uid() = user_id);

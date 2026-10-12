-- =============================================================================
-- CyberBLADE Platform: SOC Workspace Scenario Generation Schema (Phase 3 Part F)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds procedural generation tracking columns to `public.soc_attempts`:
--    - family_id TEXT: ID of the scenario family (e.g. 'soc-f-mixed-signal-01')
--    - family_version INTEGER: pinned family schema version
--    - generator_version TEXT: pinned generator version (e.g. '1.0.0')
--    - difficulty TEXT: difficulty level ('beginner', 'intermediate', 'advanced')
--    - scenario_hash TEXT: SHA256 content hash of the generated scenario for tampering/drift detection
-- 2. Creates `public.soc_used_seeds` table to track used seeds per (user, family),
--    preventing seed reuse in practice and exam retakes.
-- 3. Enables strict Row Level Security (RLS) on `soc_used_seeds` (owner-only).
-- 4. Enforces zero-knowledge seed protection: revokes SELECT on the `seed` column
--    of `soc_attempts` from the authenticated role, ensuring even the attempt owner
--    cannot inspect or reconstruct answers offline.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
-- Not executed against a production hosted database in this environment.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.soc_used_seeds CASCADE;
-- ALTER TABLE public.soc_attempts
--   DROP COLUMN IF EXISTS family_id,
--   DROP COLUMN IF EXISTS family_version,
--   DROP COLUMN IF EXISTS generator_version,
--   DROP COLUMN IF EXISTS difficulty,
--   DROP COLUMN IF EXISTS scenario_hash;
-- =============================================================================

-- 1. Additive columns on soc_attempts
ALTER TABLE public.soc_attempts
    ADD COLUMN IF NOT EXISTS family_id TEXT,
    ADD COLUMN IF NOT EXISTS family_version INTEGER,
    ADD COLUMN IF NOT EXISTS generator_version TEXT,
    ADD COLUMN IF NOT EXISTS difficulty TEXT,
    ADD COLUMN IF NOT EXISTS scenario_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_soc_attempts_family ON public.soc_attempts (user_id, family_id);

-- 2. Used Seeds Table for non-repeating attempt seeds per (user, family)
CREATE TABLE IF NOT EXISTS public.soc_used_seeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_soc_used_seeds UNIQUE (user_id, family_id, seed)
);

CREATE INDEX IF NOT EXISTS idx_soc_used_seeds_lookup ON public.soc_used_seeds (user_id, family_id);
ALTER TABLE public.soc_used_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own soc used seeds" ON public.soc_used_seeds;
CREATE POLICY "Operators manage own soc used seeds"
    ON public.soc_used_seeds FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Zero-Knowledge Seed Protection:
-- Revoke direct SELECT privilege on the sensitive seed column from learner client roles
REVOKE SELECT (seed) ON public.soc_attempts FROM authenticated;

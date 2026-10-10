-- =============================================================================
-- CyberBLADE Platform: Initial Schema Migration (Phase 2G)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
-- =============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Operators (Profiles attached to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operators (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL UNIQUE,
    rank INT NOT NULL DEFAULT 0 CHECK (rank >= 0),
    ethics_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Lesson Progress
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    checks_passed TEXT[] NOT NULL DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_lesson UNIQUE (user_id, lesson_id)
);

-- -----------------------------------------------------------------------------
-- 3. Lab Attempts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lab_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('practice', 'challenge')),
    objectives_solved TEXT[] NOT NULL DEFAULT '{}',
    hints_used INT NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 4. XP Events (Idempotent rewards ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    amount INT NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_xp_source UNIQUE (user_id, source)
);

-- -----------------------------------------------------------------------------
-- 5. Rank Challenges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rank_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rank INT NOT NULL CHECK (rank >= 0),
    lab_attempt_id UUID NOT NULL REFERENCES public.lab_attempts(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'passed', 'failed')),
    finished_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 6. Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_operators_handle ON public.operators(handle);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_user_lab ON public.lab_attempts(user_id, lab_id, mode);
CREATE INDEX IF NOT EXISTS idx_xp_events_user ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_challenges_user_rank ON public.rank_challenges(user_id, rank);

-- -----------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_challenges ENABLE ROW LEVEL SECURITY;

-- Operators Policies
CREATE POLICY "Operators can read own profile"
    ON public.operators FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Operators can update own profile"
    ON public.operators FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Operators can insert own profile"
    ON public.operators FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Lesson Progress Policies
CREATE POLICY "Operators can read own lesson progress"
    ON public.lesson_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own lesson progress"
    ON public.lesson_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators can update own lesson progress"
    ON public.lesson_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- Lab Attempts Policies
CREATE POLICY "Operators can read own lab attempts"
    ON public.lab_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own lab attempts"
    ON public.lab_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators can update own lab attempts"
    ON public.lab_attempts FOR UPDATE
    USING (auth.uid() = user_id);

-- XP Events Policies
CREATE POLICY "Operators can read own XP events"
    ON public.xp_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own XP events"
    ON public.xp_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Rank Challenges Policies
CREATE POLICY "Operators can read own challenges"
    ON public.rank_challenges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators can insert own challenges"
    ON public.rank_challenges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators can update own challenges"
    ON public.rank_challenges FOR UPDATE
    USING (auth.uid() = user_id);

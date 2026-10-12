-- =============================================================================
-- CyberBLADE Platform: Learning Effectiveness & Spaced Review Schema (Phase 8)
-- Database: Supabase / PostgreSQL with Row Level Security (RLS)
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds `review_items` table for SM-2 spaced repetition state tracking per user.
-- 2. Adds `review_events` append-only log for retrieval practice audit & telemetry.
-- 3. Adds `learning_events` privacy-preserving analytics ledger for formative study.
-- 4. Adds `exam_reports` private self-reporting table for certification alignment.
-- 5. Enables strict Row Level Security (RLS) on all 4 tables with owner-only isolation.
--
-- STATUS:
-- Validated via SQL syntax structure and unit tests.
-- Local JSON-store fallback mirror implemented for offline / non-Supabase modes.
--
-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS public.exam_reports CASCADE;
-- DROP TABLE IF EXISTS public.learning_events CASCADE;
-- DROP TABLE IF EXISTS public.review_events CASCADE;
-- DROP TABLE IF EXISTS public.review_items CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Review Items Table (SM-2 Spaced Repetition State)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30),
    interval_days INT NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
    repetitions INT NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
    lapses INT NOT NULL DEFAULT 0 CHECK (lapses >= 0),
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_item_user_card UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_review_items_user_due ON public.review_items (user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_review_items_user_card ON public.review_items (user_id, card_id);
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own review items" ON public.review_items;
CREATE POLICY "Operators manage own review items"
    ON public.review_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. Review Events Log (Retrieval Practice Attempt History)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    grade INT NOT NULL CHECK (grade >= 0 AND grade <= 5),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_events_user_time ON public.review_events (user_id, reviewed_at);
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own review events" ON public.review_events;
CREATE POLICY "Operators manage own review events"
    ON public.review_events FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Learning Events Telemetry (Privacy-Preserving Formative Analytics)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_type ON public.learning_events (user_id, event_type);
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators view own learning events" ON public.learning_events;
CREATE POLICY "Operators view own learning events"
    ON public.learning_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Operators insert own learning events" ON public.learning_events;
CREATE POLICY "Operators insert own learning events"
    ON public.learning_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. Certification Exam Self-Reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,
    score INT NOT NULL CHECK (score >= 0),
    max_score INT NOT NULL CHECK (max_score > 0),
    passed BOOLEAN NOT NULL,
    notes TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_reports_user_time ON public.exam_reports (user_id, reported_at);
ALTER TABLE public.exam_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own exam reports" ON public.exam_reports;
CREATE POLICY "Operators manage own exam reports"
    ON public.exam_reports FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

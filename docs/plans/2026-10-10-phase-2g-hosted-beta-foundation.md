# Phase 2G Implementation Plan: Hosted Closed Beta Foundation

**Branch:** `phase-2g-hosted-beta-foundation`  
**Goal:** Transition CyberBLADE from a local-only prototype into a hosted, production-ready platform powered by Supabase (Postgres + Auth + Row Level Security) and enterprise edge security headers, while preserving 100% backward compatibility with the local-first file-backed workflow.

---

## 1. Architectural Strategy

CyberBLADE was designed with explicit storage abstraction boundaries:
- `OperatorStore` in `lib/identity/operator-store.ts`
- `ProgressRepo` in `lib/progress/repo.ts` and `getCtx()` in `lib/progress/context.ts`

Phase 2G delivers the complete hosted implementation:
1. **Dynamic Environment Detection**:
   When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are provided, the platform uses `SupabaseOperatorStore` and `SupabaseProgressRepo`. When running offline, in CI, or during local unit tests, it seamlessly falls back to `FileOperatorStore` and `FileProgressRepo`.
2. **Deterministic Database Schema**:
   SQL migration file in `supabase/migrations/` defining `operators`, `lesson_progress`, `lab_attempts`, `xp_events`, and `rank_challenges` with Row Level Security (RLS) guaranteeing strict operator tenant isolation.
3. **Hosted Authentication**:
   - Email Magic Links via Supabase Auth
   - Google OAuth integration
   - Callback handler `/auth/callback` exchanging code for session cookies
4. **Edge Security Middleware**:
   Next.js `middleware.ts` setting CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and refreshing Supabase session tokens.

---

## 2. Implementation Steps

### Task 1: Supabase Schema & Database Types
- `supabase/migrations/20261010000000_phase_2g_initial_schema.sql`:
  - Tables: `operators`, `lesson_progress`, `lab_attempts`, `xp_events`, `rank_challenges`
  - RLS policies ensuring `auth.uid() = user_id` on all tables
  - Indexes on primary query paths
- `lib/supabase/types.ts`: TypeScript Database definition matching tables and views.
- `lib/supabase/config.ts`: Pure configuration helper with `isSupabaseConfigured()`.

### Task 2: Supabase Client Utilities
- `lib/supabase/client.ts`: Browser client via `@supabase/ssr`
- `lib/supabase/server.ts`: Server client via `@supabase/ssr` (handling Next.js cookie store)
- `lib/supabase/admin.ts`: Service role client for server-side atomic administrative operations

### Task 3: Supabase Storage Implementations
- `lib/identity/supabase-operator-store.ts`: Implements `OperatorStore`
- `lib/progress/supabase-repo.ts`: Implements `ProgressRepo`
- Update `lib/identity/operator-store.ts` to return `SupabaseOperatorStore` when configured
- Update `lib/progress/context.ts` to return `SupabaseProgressRepo` when configured

### Task 4: Hosted Auth Callback & Flows
- `app/auth/callback/route.ts`: Server Route exchanging auth code for session
- `components/auth/AuthModal.tsx` or `/start` enhancements supporting Email Magic Link & Google OAuth

### Task 5: Edge Middleware & Production Security Headers
- `middleware.ts`: Next.js middleware with security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy) and Supabase session management.

### Task 6: Unit Testing & Verification Gates
- Unit tests for Supabase store and repo
- All 118 existing vitest tests passing
- `check:content`, `lint`, `typecheck`, `build` passing
- Update `docs/reports/phase-2-roadmap-report.md`
- Merge into `main`

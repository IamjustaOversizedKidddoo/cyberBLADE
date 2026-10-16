# Deploying the closed beta (Vercel + hosted Supabase)

Owner-run, step by step, in dependency order. Nothing in this repo deploys anything, creates accounts or calls a hosted service on its own. Scope: an invite-only beta for 20–100 learners.

Platform facts below were checked against the official docs on **2026-10-16**. Re-check them before launch, because plans change. Items marked **UNVERIFIED** could not be confirmed in the docs; treat them as assumptions.

| Fact | Source |
|---|---|
| Hobby is for "non-commercial, personal use only". A paid beta, or a beta run by a business, needs **Pro**. | https://vercel.com/docs/plans/hobby |
| Hobby cron runs at most once per day, with ±59 min precision. Pro allows per-minute schedules. 100 cron jobs per project. | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron sends an HTTP **GET** with `Authorization: Bearer $CRON_SECRET`. Delivery is best-effort and may be duplicated, so jobs must be idempotent. | https://vercel.com/docs/cron-jobs/manage-cron-jobs |
| Function duration: 300 s default and maximum on Hobby; up to 800 s on Pro. Request/response body limit 4.5 MB. | https://vercel.com/docs/functions/limitations |
| Env vars are scoped per environment (Production / Preview / Development) and can be scoped per preview branch. Changes apply only to new deployments. 64 KB total per deployment. | https://vercel.com/docs/environment-variables |
| Supabase backups: Free has no daily backups (export with the CLI). Pro keeps 7 days, Team 14, Enterprise up to 30. Point-in-time recovery is a paid add-on. | https://supabase.com/docs/guides/platform/backups |
| Supabase Site URL and Redirect URLs are set under Auth → URL Configuration. `*` stops at `.` and `/`; `**` matches anything. For previews: `https://*-<team-slug>.vercel.app/**`. For production, use exact paths. | https://supabase.com/docs/guides/auth/redirect-urls |
| **UNVERIFIED:** Free Supabase projects pause after a period of inactivity; the built-in email sender is heavily rate-limited (configure custom SMTP for magic links); connection and pooler limits per plan. | check your plan's pricing page |

**Plan recommendation (decision for you):** Vercel **Pro** plus Supabase **Pro** for production. Pro is needed for commercial use, 7-day backups and no pausing. Staging can stay on Free with daily `npm run db:backup`.

## Data practices (what the beta notice must stay true to)

- **Stored in Supabase:**
  - email and auth identity;
  - handle;
  - lesson, lab and exam progress;
  - SOC workspace actions and reports;
  - Handler usage counts (not conversation text);
  - feedback text;
  - the beta-notice acknowledgement timestamp;
  - the invite redemption.
- **AI providers (Gemini, Groq):** get the learner's Handler question and lesson context only. No email, no name, no user id. AI report grading is **off**.
- **Logs:** request ids, routes, status codes and counts. Tokens, cookies, emails, IPs, flags, Handler text and report text are redacted (`lib/observability/redact.ts`). Error reports carry no learner content.
- **Learner controls:** export on /account; deletion on /account removes every learner row and the Supabase auth user. The audit log keeps an unlinked `account.deleted` event.
- **Backups:** encrypted backups made by the owner persist after a deletion until rotated out (`BACKUP_KEEP`, default 14). The notice must say so. **Lawyer review needed** before launch (`lib/beta/notice.ts`).

## 1. Supabase projects (two: staging and production)

1. Create **two** projects: `cyberblade-staging` and `cyberblade-prod`. Use the same region, close to your learners. They must never share keys.
2. In each project, copy from Settings → API: the project URL, the anon key, and the service-role key (server only). From Connect, also copy the **session pooler** connection string; the backup script uses it.

## 2. Migrations, in order (staging first, then production)

**Before every production migration**, take a backup and verify it:

```bash
npm run db:backup
```

```bash
npm run db:restore-check -- --file "<printed path>"
```

Apply the files in `supabase/migrations/` in filename order. Use either `supabase link --project-ref <ref>` and then `supabase db push`, or paste each file into the SQL editor in order:

```
20261010000000_phase_2g_initial_schema.sql
20261011120000_p5_security_hardening.sql
20261012000000_p8_learning_effectiveness.sql
20261012120000_phase_3_soc_workspace.sql
20261013000000_phase_3_soc_scenario_generation.sql
20261013120000_phase_3_soc_enrichment.sql
20261013180000_phase_3_soc_query_language.sql
20261013200000_phase_3_soc_report_engine.sql
20261014120000_phase_3_soc_ai_grading.sql
20261014180000_phase_3_access_hardening.sql
20261015120000_phase_3_soc_exams.sql
20261015180000_phase_3_soc_l1_audit_fixes.sql
20261016120000_beta_hardening.sql
20261016180000_soc_l2_exams.sql   (L2 schema; the feature stays off with SOC_L2_ENABLED=false)
```

All of these were executed on PGlite in tests (`npm run test:db`). **None has been executed against a hosted database.** Rollback notes are in each file's header. A bad migration is handled by the runbook below.

## 3. Auth providers and redirect URLs (each project)

1. **Site URL:**
   - prod: `https://<your-domain>`
   - staging: `https://<staging-domain>`, or your preview alias
2. **Redirect URLs:**
   - prod: exactly `https://<your-domain>/auth/callback` and nothing else.
   - staging: `https://*-<team-slug>.vercel.app/**` plus `http://localhost:3000/**`.
3. **Email magic link:** keep the Email provider enabled. `staging:verify` also needs email/password sign-in on **staging only**. Set up custom SMTP, since the default sender is rate-limited (UNVERIFIED limit).
4. **Google OAuth:**
   - Create an OAuth client in Google Cloud.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Paste the client id and secret into Auth → Providers → Google.
   - Use separate clients for staging and prod.
5. **GitHub OAuth:** do the same with a GitHub OAuth App, using the same callback URL.
6. Turn on "Confirm email". Leave sign-ups enabled, because the invite gate runs in `/auth/callback`: a new user without a valid stashed invite is signed out and sent to `/start?error=invite_required`. An orphan auth user can remain; see the decisions log.

## 4. Vercel project and environment variables

1. Import the repo into Vercel (framework: Next.js; Node 24 per `package.json` engines). Production branch: `main`.
2. Add variables from `.env.example` **separately per environment**:
   - **Production:** the prod Supabase URL and keys, `NEXT_PUBLIC_SITE_URL=https://<your-domain>`, a new `CRON_SECRET`, Handler keys and the beta flags.
   - **Preview:** the **staging** Supabase URL and keys, their own `CRON_SECRET`, and `NEXT_PUBLIC_SITE_URL` set to the staging alias. **Never** the production keys.
   - Mark `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `GEMINI_API_KEY` and `GROQ_API_KEY` as **Secret** type. They have no `NEXT_PUBLIC_` prefix; the app refuses to start if a service key appears in any `NEXT_PUBLIC_` variable.
3. Beta flag set (tested in `tests/security/beta-flags.test.ts`):
   - on: `BETA_INVITE_ONLY`, `SOC_WORKSPACE_ENABLED`, `SOC_ENRICHMENT_ENABLED`, `SOC_QUERY_ENABLED`, `SOC_REPORTS_ENABLED`, `SOC_EXAMS_ENABLED`, `SOC_HANDLER_ENABLED`;
   - off: `SOC_L2_ENABLED`, `SOC_RULES_ENABLED`, `MAINTENANCE_MODE`;
   - `SOC_AI_GRADING_MODE=off`;
   - `NEON_SHOW_DRAFTS=true` (decision: every lesson is still `status: draft`).
4. Never set `CYBERBLADE_ALLOW_LOCAL_E2E`, `HANDLER_DEBUG_LOGS`, `CYBERBLADE_SHOW_DEV_UI`, `RATE_LIMIT_BACKEND=memory` or `SOC_AI_PROVIDER=mock`. Production refuses to start with any of them, and with placeholder values or a missing required variable; the error names the variable, never its value.
5. Never set the operator-script variables (`SUPABASE_DB_URL`, `BACKUP_*`, `STAGING_*`) in Vercel.

## 5. Cron secret and jobs

- Generate the secret with `openssl rand -hex 32` (at least 32 characters), once per environment.
- `vercel.json` schedules `/api/cron/cleanup` at 03:15 UTC and `/api/cron/ai-grading` at 03:45 UTC, both daily, which is Hobby-compatible.
- The routes accept GET (Vercel's method) and POST, compare the Bearer secret in constant time, are rate limited (12/hour) and idempotent.
- `maxDuration` is 60 s for cleanup and 120 s for AI grading, below the 300 s Hobby limit. AI grading does nothing while the mode is off.
- Measured request-time budgets (local):

  | Action | ms |
  |---|---|
  | shiftStart | 348 |
  | alertQueueFinalize | 431 |
  | all others | below 300 |

  All are well under the function limit.

## 6. Domain and TLS

Add the domain in Vercel → Domains and follow its DNS instructions; the certificate is automatic. Then set `NEXT_PUBLIC_SITE_URL` and the Supabase Site/Redirect URLs to the final domain, and redeploy (env changes apply only to new deployments).

## 7. First admin actions and invite codes

Run these from your machine with prod `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the shell environment, never committed:

```bash
npm run beta:invites -- create --hosted --uses 1 --days 14 --label "cohort A" --by owner --count 20
```

Codes print **once**; only the hashes are stored. List and revoke with `list --hosted` and `revoke --hosted --id <id> --by owner`. Every change is audit-logged.

## 8. Verify before inviting anyone

1. Run staging data isolation plus the smoke test (staging keys in env only). This creates and deletes two throwaway users.

   ```bash
   STAGING_VERIFY_CONFIRM=staging npm run staging:verify
   ```

2. Run the smoke test against production (read-only, about 20 requests):

   ```bash
   npm run smoke -- https://<your-domain>
   ```

3. Do the manual pass: sign up with an invite → beta notice → a lesson → a lab → start an exam → send feedback.
4. Take the first production backup and restore-check it. Then schedule `npm run db:backup` daily (Task Scheduler or cron on your machine), and run `npm run ops:daily -- --hosted` each morning.

## 9. Alert thresholds (`npm run ops:daily` prints ALERT lines)

| Signal | Threshold | Action |
|---|---|---|
| Estimated AI spend | ≥ 80% of `HANDLER_MAX_GLOBAL_DAILY_BUDGET_USD` | Check for abuse; lower per-learner limits |
| Handler tokens | ≥ 80% of `HANDLER_GLOBAL_DAILY_TOKEN_LIMIT` | The ceiling will stop the Handler for everyone at 100% |
| Feedback items | ≥ 25 in a day | Something is broken; export with `npm run beta:feedback -- --hosted` |
| `/api/ready` | non-200 | Config or DB problem; check Vercel logs by request id |
| 5xx rate in Vercel logs | > 1% of requests in an hour | Bad deploy; roll back |

## 10. Rollback and kill switches

- **Roll back the code:** Vercel → Deployments → previous good deployment → Promote to Production (instant; no rebuild).
- **Maintenance:** set `MAINTENANCE_MODE=true` and redeploy. Every route returns 503 with Retry-After, except `/api/health`.
- **Per-feature switches:** each `SOC_*_ENABLED=false`; `SOC_AI_GRADING_KILL_SWITCH=1`. Removing `GROQ_API_KEY` and `GEMINI_API_KEY` stops all AI spend: the Handler falls back to its offline heuristic tutor (`lib/handler/providers/factory.ts`).
- **Close sign-ups:** revoke all invites (`beta:invites -- revoke`).

## Incident runbook

| Incident | Do this, in order |
|---|---|
| **Leaked key** | 1. Rotate it at the source (Supabase: API → roll the service or anon key; Google, GitHub, Groq, Gemini consoles; new `CRON_SECRET`). 2. Update the Vercel env var for the right environment and redeploy. 3. Check Supabase logs and `audit_events` for use since the leak. 4. If the service key leaked, assume full data read: assess notification duties (lawyer). |
| **Bad deploy** | Promote the previous deployment (step 10), confirm with `npm run smoke`, then fix forward on a branch and verify on Preview first. |
| **Bad migration** | 1. Set `MAINTENANCE_MODE=true`. 2. Apply the rollback SQL from the migration's header, or restore: Supabase dashboard backup (Pro), or your latest `db:backup` restored with `psql` after `db:restore-check` passes. 3. Re-run `staging:verify` on staging before retrying. |
| **Abuse wave** (sign-up, Handler or feedback spam) | 1. Revoke the leaked invite codes. 2. Lower `HANDLER_DAILY_*` limits and redeploy. 3. Ban the abusing user in Supabase Auth and delete them via `delete_user_account`. Rate limits are already enforced in Postgres; check `rate_limit_buckets` for the hot keys. |
| **AI cost spike** | 1. Lower `HANDLER_MAX_GLOBAL_DAILY_BUDGET_USD` or `HANDLER_GLOBAL_DAILY_TOKEN_LIMIT`, or remove the provider keys. 2. Confirm `SOC_AI_GRADING_MODE=off` and the kill switch. 3. Set a hard spend cap in the provider console. |
| **Deletion request** (outside the app) | 1. Verify the requester owns the account email. 2. As service role: `select public.delete_user_account('<uuid>')`, then delete the auth user in the dashboard. 3. Reply with the date. The data is in your backups until they rotate out (≤ `BACKUP_KEEP` days); do not restore their rows if you ever restore. |

/**
 * Verifies data isolation on a HOSTED STAGING Supabase project, then smoke-tests the staging site.
 * Owner-run only; keys come from the environment and are never written anywhere.
 *   STAGING_VERIFY_CONFIRM=staging
 *   STAGING_SUPABASE_URL=...  STAGING_SUPABASE_ANON_KEY=...  STAGING_SUPABASE_SERVICE_ROLE_KEY=...
 *   STAGING_BASE_URL=https://<preview-or-staging-domain>   [PRODUCTION_SUPABASE_URL=... (refused if equal)]
 *   npm run staging:verify
 * Creates two throwaway users (verify-*@example.test, random passwords; needs the Email provider
 * enabled on the staging project), runs lib/ops/staging-checks.ts, deletes both users, then runs
 * the ~20-request smoke (lib/ops/smoke.ts). Exit code 1 on any failure.
 */
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runStagingChecks, type DbAs, type Res } from "../lib/ops/staging-checks";
import { runSmoke } from "../lib/ops/smoke";

const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`set ${n}`);
  return v;
};

function adapter(c: SupabaseClient): DbAs {
  const wrap = (r: { data: unknown; error: { code?: string; message: string } | null; count?: number | null }): Res => ({
    rows: Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [],
    error: r.error ? { code: r.error.code, message: r.error.message } : null,
    count: r.count ?? 0,
  });
  return {
    select: async (t, cols, [k, v]) => wrap(await c.from(t).select(cols).eq(k, v as string)),
    insert: async (t, row) => wrap(await c.from(t).insert(row)),
    update: async (t, patch, [k, v]) => wrap(await c.from(t).update(patch, { count: "exact" }).eq(k, v as string)),
    delete: async (t, [k, v]) => wrap(await c.from(t).delete({ count: "exact" }).eq(k, v as string)),
    rpc: async (fn, args) => wrap(await c.rpc(fn, args)),
  };
}

async function main() {
  if (process.env.STAGING_VERIFY_CONFIRM !== "staging") throw new Error("set STAGING_VERIFY_CONFIRM=staging to confirm this is NOT production (it writes and deletes test users).");
  const url = env("STAGING_SUPABASE_URL");
  if (process.env.PRODUCTION_SUPABASE_URL && process.env.PRODUCTION_SUPABASE_URL === url) throw new Error("STAGING_SUPABASE_URL equals PRODUCTION_SUPABASE_URL: refusing.");
  const anonKey = env("STAGING_SUPABASE_ANON_KEY");
  const svc = createClient(url, env("STAGING_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

  const tag = crypto.randomBytes(4).toString("hex");
  const made: string[] = [];
  const learner = async (who: string) => {
    const email = `verify-${tag}-${who}@example.test`;
    const password = crypto.randomBytes(24).toString("base64url");
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { cyberblade_staging_verify: true } });
    if (error || !data.user) throw new Error(`could not create test user ${who}: ${error?.message}`);
    made.push(data.user.id);
    const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const s = await c.auth.signInWithPassword({ email, password });
    if (s.error) throw new Error(`test user ${who} could not sign in (is the Email provider enabled on staging?): ${s.error.message}`);
    return { id: data.user.id, client: c };
  };

  let failed = false;
  try {
    const A = await learner("a");
    const B = await learner("b");
    const checks = await runStagingChecks({
      svc: adapter(svc),
      a: adapter(A.client),
      b: adapter(B.client),
      uidA: A.id,
      uidB: B.id,
      deleteAuthUser: async (uid) => {
        const { error } = await svc.auth.admin.deleteUser(uid);
        if (error) throw new Error(`auth user deletion failed: ${error.message}`);
        made.splice(made.indexOf(uid), 1);
      },
    });
    console.log("Data isolation (staging Supabase)");
    for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    failed = checks.some((c) => !c.ok);
  } finally {
    for (const uid of [...made]) {
      await svc.rpc("delete_user_account", { target_user_id: uid });
      await svc.auth.admin.deleteUser(uid);
    }
  }

  const base = process.env.STAGING_BASE_URL;
  if (base) {
    const { checks, requests } = await runSmoke(base);
    console.log(`Smoke (${requests} requests to ${new URL(base).host})`);
    for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    failed ||= checks.some((c) => !c.ok);
  } else {
    console.log("STAGING_BASE_URL not set: smoke skipped.");
  }
  console.log(failed ? "STAGING VERIFY FAILED" : "STAGING VERIFY PASSED");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`staging:verify: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

/**
 * Daily operations summary (aggregates only; no learner ids or text): Handler requests and tokens,
 * estimated AI spend, active learners, feedback and invite activity, with ALERT lines when a
 * threshold in docs/ops/deploy-vercel.md "Alert thresholds" is crossed.
 *   npm run ops:daily -- [--hosted] [--date YYYY-MM-DD]
 * Spend estimate: tokens x HANDLER_PRICE_PER_1M_TOKENS_USD (default 0.60, an assumption; set it to
 * your provider's real blended price).
 */
import fs from "node:fs/promises";
import path from "node:path";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const day = arg("date") ?? new Date().toISOString().slice(0, 10);
const price = Number(process.env.HANDLER_PRICE_PER_1M_TOKENS_USD ?? 0.6);
const budget = Number(process.env.HANDLER_MAX_GLOBAL_DAILY_BUDGET_USD ?? 10);
const globalTokenLimit = Number(process.env.HANDLER_GLOBAL_DAILY_TOKEN_LIMIT ?? 500_000);

type Summary = { handlerRequests: number; handlerTokens: number; learnersUsingHandler: number; feedbackToday: number; redemptionsToday: number };

async function local(): Promise<Summary> {
  const dir = process.env.NEON_DATA_DIR ?? ".data";
  const read = async (f: string) => JSON.parse(await fs.readFile(path.join(dir, f), "utf8").catch(() => "{}"));
  const usage = (await read("handler-usage.json")).records ?? {};
  const beta = await read("beta.json");
  const rows = Object.entries(usage as Record<string, { requests: number; inputTokens: number; outputTokens: number }>).filter(([k]) => k.endsWith(`:${day}`));
  const global = rows.find(([k]) => k.startsWith("__global_daily_ceiling__"))?.[1];
  return {
    handlerRequests: global?.requests ?? 0,
    handlerTokens: (global?.inputTokens ?? 0) + (global?.outputTokens ?? 0),
    learnersUsingHandler: rows.filter(([k]) => !k.startsWith("__global")).length,
    feedbackToday: Object.values((beta.feedback ?? {}) as Record<string, { createdAt: string }>).filter((f) => f.createdAt.startsWith(day)).length,
    redemptionsToday: Object.values((beta.redemptions ?? {}) as Record<string, { redeemedAt: string }>).filter((r) => r.redeemedAt.startsWith(day)).length,
  };
}

async function hosted(): Promise<Summary> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("--hosted needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  const c = createClient(url, key, { auth: { persistSession: false } });
  const g = await c.from("handler_usage_global").select("requests_count, input_tokens, output_tokens").eq("date", day).maybeSingle();
  const users = await c.from("handler_usage").select("user_id", { count: "exact", head: true }).eq("date", day);
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString();
  const fb = await c.from("learner_feedback").select("id", { count: "exact", head: true }).gte("created_at", `${day}T00:00:00Z`).lt("created_at", next);
  const rd = await c.from("beta_invite_redemptions").select("id", { count: "exact", head: true }).gte("redeemed_at", `${day}T00:00:00Z`).lt("redeemed_at", next);
  return {
    handlerRequests: Number(g.data?.requests_count ?? 0),
    handlerTokens: Number(g.data?.input_tokens ?? 0) + Number(g.data?.output_tokens ?? 0),
    learnersUsingHandler: users.count ?? 0,
    feedbackToday: fb.count ?? 0,
    redemptionsToday: rd.count ?? 0,
  };
}

async function main() {
  const s = process.argv.includes("--hosted") ? await hosted() : await local();
  const spend = (s.handlerTokens / 1_000_000) * price;
  console.log(`CyberBLADE daily summary for ${day}`);
  console.log(`  Handler: ${s.handlerRequests} requests, ${s.handlerTokens} tokens, ${s.learnersUsingHandler} learners`);
  console.log(`  Estimated AI spend: $${spend.toFixed(2)} (at $${price}/1M tokens; ceiling $${budget})`);
  console.log(`  Feedback received: ${s.feedbackToday}; invites redeemed: ${s.redemptionsToday}`);
  const alerts: string[] = [];
  if (spend >= budget * 0.8) alerts.push(`AI spend at ${Math.round((spend / budget) * 100)}% of the daily ceiling`);
  if (s.handlerTokens >= globalTokenLimit * 0.8) alerts.push(`Handler tokens at ${Math.round((s.handlerTokens / globalTokenLimit) * 100)}% of HANDLER_GLOBAL_DAILY_TOKEN_LIMIT`);
  if (s.feedbackToday >= 25) alerts.push(`${s.feedbackToday} feedback items today: check for a broken page or lesson`);
  for (const a of alerts) console.log(`  ALERT: ${a}`);
  if (!alerts.length) console.log("  No alerts.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

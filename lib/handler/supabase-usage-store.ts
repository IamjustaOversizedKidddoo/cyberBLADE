/**
 * Hosted Handler metering (beta hardening). `handler_usage_add` updates the learner's daily row and
 * the all-learner row in one call, so the global spend ceiling is recorded by the learner's write;
 * a separate global write is a no-op here. Service role only (see migration 20261016120000).
 */
import type { HandlerDailyUsage, HandlerUsageStore } from "./metering";

const GLOBAL = "__global_daily_ceiling__";
const ZERO = (): HandlerDailyUsage => ({ requests: 0, inputTokens: 0, outputTokens: 0, lastRequestAt: "" });

type Row = { requests_count: number; input_tokens: number; output_tokens: number; last_request_at?: string };
type Client = {
  from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { eq?: (c: string, v: string) => unknown; maybeSingle: () => PromiseLike<{ data: Row | null; error: unknown }> } & Record<string, unknown> } };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const toUsage = (r: Row | null | undefined): HandlerDailyUsage =>
  r ? { requests: Number(r.requests_count), inputTokens: Number(r.input_tokens), outputTokens: Number(r.output_tokens), lastRequestAt: r.last_request_at ?? "" } : ZERO();

export class SupabaseHandlerUsageStore implements HandlerUsageStore {
  constructor(private readonly getClient: () => Promise<Client | null> = defaultClient) {}

  async getUsage(userId: string, dateStr: string): Promise<HandlerDailyUsage> {
    const c = await this.getClient();
    if (!c) return ZERO();
    if (userId === GLOBAL) {
      const { data } = await c.from("handler_usage_global").select("requests_count, input_tokens, output_tokens, last_request_at").eq("date", dateStr).maybeSingle();
      return toUsage(data);
    }
    const q = c.from("handler_usage").select("requests_count, input_tokens, output_tokens, last_request_at").eq("user_id", userId) as unknown as {
      eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: Row | null }> };
    };
    const { data } = await q.eq("date", dateStr).maybeSingle();
    return toUsage(data);
  }

  async recordUsage(userId: string, dateStr: string, inputTokens: number, outputTokens: number): Promise<HandlerDailyUsage> {
    if (userId === GLOBAL) return this.getUsage(GLOBAL, dateStr); // already counted by the learner's call
    const c = await this.getClient();
    if (!c) return ZERO();
    const { data, error } = await c.rpc("handler_usage_add", { p_user_id: userId, p_date: dateStr, p_input: Math.max(0, Math.round(inputTokens)), p_output: Math.max(0, Math.round(outputTokens)) });
    if (error) throw new Error("Handler usage could not be recorded.");
    return toUsage(Array.isArray(data) ? (data[0] as Row) : null);
  }
}

async function defaultClient(): Promise<Client | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient() as unknown as Client | null;
}

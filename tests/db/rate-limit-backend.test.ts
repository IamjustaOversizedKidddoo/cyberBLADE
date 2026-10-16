/**
 * The app's Postgres rate-limit backend against the real SQL function (PGlite), plus backend
 * selection: production refuses the in-memory limiter, and a broken backend fails closed.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { PGlite } from "@electric-sql/pglite";
import { as, createSupabaseLikeDb } from "./supabase-emulation";
import { hashRateLimitKey, memoryBackend, postgresBackend, selectRateLimitBackend } from "@/lib/security/rate-limit";

let db: PGlite;
// Minimal supabase-js rpc() adapter over PGlite, running as the service role.
const rpcClient = () => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    try {
      const r = await as(db, { role: "service_role" }, (tx) => tx.query(`SELECT * FROM public.${fn}($1, $2, $3)`, [args.p_key, args.p_max, args.p_window_ms]), true);
      return { data: r.rows, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },
});

beforeAll(async () => {
  db = await createSupabaseLikeDb();
}, 120_000);

describe("postgres rate-limit backend", () => {
  it("allows exactly max hits for one key across concurrent callers (one shared counter)", async () => {
    const backend = postgresBackend(rpcClient);
    const results = await Promise.all(Array.from({ length: 12 }, () => backend.hit("exam:answer:user-1", 5, 60_000)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    const blocked = results.find((r) => !r.allowed)!;
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect((await backend.hit("exam:answer:user-2", 5, 60_000)).allowed).toBe(true);
  });

  it("stores only a hash of the key (no user id or IP in clear)", async () => {
    await postgresBackend(rpcClient).hit("account:create:ip:203.0.113.5", 10, 60_000);
    const rows = await as(db, { role: "service_role" }, (tx) => tx.query<{ bucket_key: string }>(`SELECT bucket_key FROM public.rate_limit_buckets`));
    expect(rows.rows.map((r) => r.bucket_key)).toContain(hashRateLimitKey("account:create:ip:203.0.113.5"));
    expect(JSON.stringify(rows.rows)).not.toMatch(/203\.0\.113\.5|user-1/);
  });

  it("fails closed when the backend errors or is unavailable", async () => {
    const broken = postgresBackend(() => ({ rpc: async () => ({ data: null, error: { message: "connection refused" } }) }));
    expect(await broken.hit("k", 100, 1000)).toMatchObject({ allowed: false, unavailable: true });
    await expect(postgresBackend(() => null).hit("k", 100, 1000)).rejects.toThrow("unavailable");
  });
});

describe("backend selection", () => {
  it("production must use Postgres; the in-memory limiter fails loudly there", () => {
    const pg = postgresBackend(() => null);
    expect(() => selectRateLimitBackend({ NODE_ENV: "production", RATE_LIMIT_BACKEND: "memory" }, () => pg)).toThrow(/in-memory rate limiter is per instance/);
    expect(() => selectRateLimitBackend({ VERCEL: "1", RATE_LIMIT_BACKEND: "memory" }, () => pg)).toThrow(/per instance/);
    expect(selectRateLimitBackend({ NODE_ENV: "production" }, () => pg)).toBe(pg);
    expect(selectRateLimitBackend({ VERCEL: "1" }, () => pg)).toBe(pg);
  });

  it("local development, tests and the local E2E harness use memory", () => {
    const pg = postgresBackend(() => null);
    expect(selectRateLimitBackend({ NODE_ENV: "development" }, () => pg)).toBe(memoryBackend);
    expect(selectRateLimitBackend({ NODE_ENV: "test" }, () => pg)).toBe(memoryBackend);
    expect(selectRateLimitBackend({ NODE_ENV: "production", CYBERBLADE_ALLOW_LOCAL_E2E: "true" }, () => pg)).toBe(memoryBackend);
  });
});

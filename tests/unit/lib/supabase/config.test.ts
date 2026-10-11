import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertSafeStorageMode, getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

describe("Supabase config", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("reports false when env vars are unset", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports false when only one env var is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports true when both url and anon key are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-token-123";
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("throws when getSupabaseEnv is called without configuration", () => {
    expect(() => getSupabaseEnv()).toThrow(/Supabase is not configured/);
  });

  it("returns config object when properly configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-token-123";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-456";

    const env = getSupabaseEnv();
    expect(env.url).toBe("https://example.supabase.co");
    expect(env.anonKey).toBe("anon-token-123");
    expect(env.serviceRoleKey).toBe("service-role-456");
  });

  describe("assertSafeStorageMode", () => {
    it("refuses to run local-first file store in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => {
        assertSafeStorageMode();
      }).toThrow(/PRODUCTION SECURITY VIOLATION/);
    });

    it("throws when partial Supabase configuration is provided", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => {
        assertSafeStorageMode();
      }).toThrow(/Partial Supabase configuration/);
    });

    it("passes when fully configured in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-token-123";

      expect(() => assertSafeStorageMode()).not.toThrow();
    });

    it("passes in test/dev when Supabase is unconfigured", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => assertSafeStorageMode()).not.toThrow();
    });
  });
});

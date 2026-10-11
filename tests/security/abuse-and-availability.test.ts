import { describe, it, expect, beforeEach } from "vitest";
import { checkDailyQuota, recordHandlerUsage, setHandlerUsageStore, MemoryHandlerUsageStore } from "@/lib/handler/metering";
import { checkRateLimit, resetSubmissionRateLimits } from "@/lib/progress/rate-limit";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { ProviderCircuitBreaker } from "@/lib/handler/circuit-breaker";

describe("Security Part G: Abuse Resistance, Cost Ceilings & Graceful Degradation", () => {
  beforeEach(() => {
    resetSubmissionRateLimits();
    setHandlerUsageStore(new MemoryHandlerUsageStore());
  });

  describe("Global Spend Ceiling Enforcement", () => {
    it("throttles AI Handler requests when global token spend ceiling is exceeded", async () => {
      process.env.HANDLER_GLOBAL_DAILY_TOKEN_LIMIT = "1000";

      // Learner 1 consumes 800 tokens
      await recordHandlerUsage("learner-1", 400, 400);

      // Learner 2 should still be allowed initially
      let quota = await checkDailyQuota("learner-2");
      expect(quota.allowed).toBe(true);

      // Learner 1 consumes another 300 tokens, pushing global spend to 1100 (> 1000)
      await recordHandlerUsage("learner-1", 150, 150);

      // Now all learners (even new Learner 3) must be marked quota exceeded (degrading to offline mode)
      quota = await checkDailyQuota("learner-3");
      expect(quota.allowed).toBe(false);
      expect(quota.quotaExceeded).toBe(true);

      delete process.env.HANDLER_GLOBAL_DAILY_TOKEN_LIMIT;
    });
  });

  describe("Account Creation Abuse & Registration Throttling", () => {
    it("limits account creations per IP to prevent sybil identity attacks", () => {
      const ipKey = "account:create:ip:10.0.0.1";
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(ipKey, 10, 60_000).allowed).toBe(true);
      }

      // 11th registration attempt from same IP within the minute is blocked
      const blocked = checkRateLimit(ipKey, 10, 60_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe("Optional CAPTCHA / Bot Defense Hook Point", () => {
    it("passes transparently without third-party account when unconfigured", async () => {
      delete process.env.CAPTCHA_SECRET_KEY;
      const res = await verifyCaptchaToken(undefined);
      expect(res.valid).toBe(true);
    });

    it("rejects missing tokens when CAPTCHA is configured", async () => {
      process.env.CAPTCHA_SECRET_KEY = "test-secret-key";
      const res = await verifyCaptchaToken(null);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("missing");
      delete process.env.CAPTCHA_SECRET_KEY;
    });
  });

  describe("Provider Circuit Breaker & Availability Degradation", () => {
    it("trips circuit breaker after consecutive upstream failures and recovers after cooldown", () => {
      const breaker = new ProviderCircuitBreaker({ failureThreshold: 3, cooldownMs: 500 });
      const now = Date.now();

      expect(breaker.isOpen(now)).toBe(false);
      breaker.recordFailure(now);
      breaker.recordFailure(now);
      expect(breaker.isOpen(now)).toBe(false);

      // 3rd failure trips breaker open
      breaker.recordFailure(now);
      expect(breaker.isOpen(now)).toBe(true);

      // After cooldown expires, circuit is no longer open
      expect(breaker.isOpen(now + 600)).toBe(false);

      // Success resets failure count
      breaker.recordSuccess();
      expect(breaker.isOpen(now)).toBe(false);
    });
  });
});

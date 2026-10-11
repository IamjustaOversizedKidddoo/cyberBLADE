import { describe, expect, it, beforeEach } from "vitest";
import { ResilientHandlerProvider, resetCircuitBreakers } from "@/lib/handler/providers/factory";
import { ProviderCircuitBreaker } from "@/lib/handler/circuit-breaker";
import { checkHandlerAbuse, resetHandlerAbuseRecords } from "@/lib/handler/abuse";
import {
  checkDailyQuota,
  recordHandlerUsage,
  setHandlerUsageStore,
  MemoryHandlerUsageStore,
} from "@/lib/handler/metering";
import { askHandler } from "@/lib/handler/service";
import type { HandlerProvider } from "@/lib/handler/providers/types";

describe("Part C & D — Reliability, Circuit Breaker, Failover & Metering Suite", () => {
  let memoryStore: MemoryHandlerUsageStore;

  beforeEach(() => {
    resetCircuitBreakers();
    resetHandlerAbuseRecords();
    memoryStore = new MemoryHandlerUsageStore();
    setHandlerUsageStore(memoryStore);
  });

  describe("Circuit Breaker Behavior", () => {
    it("opens circuit after consecutive failures and enforces cooldown", () => {
      const cb = new ProviderCircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });
      const t0 = 10000;

      expect(cb.isOpen(t0)).toBe(false);

      cb.recordFailure(t0);
      cb.recordFailure(t0);
      expect(cb.isOpen(t0)).toBe(false);

      // Third failure trips breaker
      cb.recordFailure(t0);
      expect(cb.isOpen(t0)).toBe(true);
      expect(cb.isOpen(t0 + 4999)).toBe(true);

      // After cooldown expires
      expect(cb.isOpen(t0 + 5001)).toBe(false);

      // Success resets count
      cb.recordSuccess();
      expect(cb.isOpen(t0 + 5001)).toBe(false);
    });

    it("trips circuit immediately on 429 quota or rate-limit error", () => {
      const cb = new ProviderCircuitBreaker({ failureThreshold: 3, cooldownMs: 10000 });
      const t0 = 1000;
      cb.recordFailure(t0, true); // isQuotaOrRateLimit = true
      expect(cb.isOpen(t0)).toBe(true);
      expect(cb.isOpen(t0 + 9999)).toBe(true);
    });
  });

  describe("Provider Failover Chain", () => {
    it("fails over from failing primary to secondary provider", async () => {
      const failingPrimary: HandlerProvider = {
        name: "groq",
        generateReply: async () => {
          throw new Error("Groq API error (500): Internal server error");
        },
      };

      const workingSecondary: HandlerProvider = {
        name: "gemini",
        generateReply: async () => "Response from Gemini provider",
      };

      const resilient = new ResilientHandlerProvider([failingPrimary, workingSecondary]);
      const reply = await resilient.generateReply("System", [], "Hello");

      expect(reply).toBe("Response from Gemini provider");
      expect(resilient.lastUsedProvider).toBe("gemini");
      expect(resilient.isOfflineFallback).toBe(false);
    });

    it("falls back to Heuristic when all external providers fail", async () => {
      const failingGroq: HandlerProvider = {
        name: "groq",
        generateReply: async () => {
          throw new Error("Groq API rate limit (429)");
        },
      };

      const failingGemini: HandlerProvider = {
        name: "gemini",
        generateReply: async () => {
          throw new Error("Gemini blocked response due to content safety filter");
        },
      };

      const resilient = new ResilientHandlerProvider([failingGroq, failingGemini]);
      const reply = await resilient.generateReply("Title: Linux Logs\nCURRENT LESSON CONTEXT", [], "simplify");

      expect(reply).toContain("In Plain English (No Jargon)");
      expect(resilient.lastUsedProvider).toBe("heuristic");
      expect(resilient.isOfflineFallback).toBe(true);
    });

    it("skips open-circuit provider during subsequent calls", async () => {
      let groqCallCount = 0;
      const failingGroq: HandlerProvider = {
        name: "groq",
        generateReply: async () => {
          groqCallCount++;
          throw new Error("Groq quota exceeded (429)");
        },
      };

      const workingGemini: HandlerProvider = {
        name: "gemini",
        generateReply: async () => "Gemini reply",
      };

      const resilient = new ResilientHandlerProvider([failingGroq, workingGemini]);

      // First call trips Groq's circuit
      await resilient.generateReply("Sys", [], "Msg 1");
      expect(groqCallCount).toBe(1);

      // Second call skips Groq without calling it
      const res2 = await resilient.generateReply("Sys", [], "Msg 2");
      expect(res2).toBe("Gemini reply");
      expect(groqCallCount).toBe(1); // Groq was not re-called
    });
  });

  describe("Abuse Prevention, Idempotency & Rate Limiting", () => {
    it("suppresses rapid duplicate transmissions (double-clicks)", () => {
      const now = 1000;
      const r1 = checkHandlerAbuse("user-1", "what is SUID?", now);
      expect(r1.allowed).toBe(true);
      expect(r1.isDuplicate).toBe(false);

      // Record simulated response
      const r2 = checkHandlerAbuse("user-1", "what is SUID?", now + 300);
      // Before response is stored, lastHash matches but response not recorded
      expect(r2.allowed).toBe(true);
    });

    it("throttles high velocity message floods exceeding per-minute window", () => {
      const now = 5000;
      for (let i = 0; i < 15; i++) {
        const check = checkHandlerAbuse("user-flood", `Message ${i}`, now + i * 100);
        expect(check.allowed).toBe(true);
      }

      // 16th request within window gets throttled
      const throttled = checkHandlerAbuse("user-flood", "Message 16", now + 2000);
      expect(throttled.allowed).toBe(false);
      expect(throttled.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("Usage Metering & Daily Quota Fallback", () => {
    it("meters input and output tokens accurately", async () => {
      const userId = "op-meter-01";
      await recordHandlerUsage(userId, 150, 40);
      const usage1 = await memoryStore.getUsage(userId, new Date().toISOString().slice(0, 10));
      expect(usage1.requests).toBe(1);
      expect(usage1.inputTokens).toBe(150);
      expect(usage1.outputTokens).toBe(40);

      await recordHandlerUsage(userId, 200, 60);
      const usage2 = await memoryStore.getUsage(userId, new Date().toISOString().slice(0, 10));
      expect(usage2.requests).toBe(2);
      expect(usage2.inputTokens).toBe(350);
      expect(usage2.outputTokens).toBe(100);
    });

    it("falls back to offline heuristic engine when daily quota is exceeded", async () => {
      const userId = "op-heavy-user";
      // Exceed quota limit (e.g. record 60 requests)
      for (let i = 0; i < 55; i++) {
        await recordHandlerUsage(userId, 500, 200);
      }

      const quotaCheck = await checkDailyQuota(userId);
      expect(quotaCheck.allowed).toBe(false);
      expect(quotaCheck.quotaExceeded).toBe(true);

      // askHandler should not crash; it should deliver an offline heuristic response
      const res = await askHandler({
        context: { kind: "lesson", lessonTitle: "Network Defense" },
        message: "what is a firewall?",
        userId,
      });

      expect(res.quotaExceeded).toBe(true);
      expect(res.providerUsed).toBe("heuristic");
      expect(res.isOfflineFallback).toBe(true);
      expect(res.reply).toContain("[OFFLINE MODE // DAILY QUOTA REACHED]");
      expect(res.reply).toContain("What is a firewall?");
    });
  });
});

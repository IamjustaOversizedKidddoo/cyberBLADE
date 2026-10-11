import { describe, expect, it } from "vitest";
import { checkSubmissionRateLimit, resetSubmissionRateLimits } from "@/lib/progress/rate-limit";
import { sanitizeEnvForClient, toSession } from "@/lib/progress/service";
import type { LabEnv } from "@/lib/lab-engine/env";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";
import type { LabAttempt } from "@/lib/progress/types";

describe("Part A: Anti-Cheat & Integrity Hardening", () => {
  it("sanitizes webapp environment to completely remove solution flags and secret tokens", () => {
    const rawEnv: LabEnv = {
      kind: "webapp",
      app: {
        appId: "sqli_portal",
        name: "Apex Vault",
        baseUrl: "http://apex-vault.internal",
        initialUrl: "http://apex-vault.internal/login",
        database: {},
        config: {
          adminToken: "secret_adm_token_12345",
          flags: {
            flag_auth_bypass: "CYBERBLADE{auth_bypass_leaked_flag}",
            flag_union_extract: "CYBERBLADE{union_extract_leaked_flag}",
          },
        },
      },
    };

    const sanitized = sanitizeEnvForClient(rawEnv);
    expect(sanitized.kind).toBe("webapp");
    if (sanitized.kind === "webapp") {
      expect(sanitized.app.config).not.toHaveProperty("flags");
      expect(sanitized.app.config).not.toHaveProperty("adminToken");
      expect((sanitized.app.config as any).flags).toBeUndefined();
      expect((sanitized.app.config as any).adminToken).toBeUndefined();
    }
  });

  it("toSession outputs a sanitized client payload", () => {
    const dummyLab: LoadedLab = {
      id: "core-r2-sqli-lab-01",
      title: "SQL Injection Lab",
      type: "webapp",
      track: "core",
      rank: 2,
      estimated_minutes: 20,
      briefing: "briefing.md",
      briefingText: "briefing",
      dataset: { generator: "sqli_lab", params: {} },
      objectives: [
        { id: "o1", prompt: "bypass login", check: { kind: "flag", answer_from: "generator.flag_auth" } },
      ],
      hints: {},
      xp: 100,
      mitre: [],
    };

    const dummyAttempt: LabAttempt = {
      id: "att_123",
      userId: "user_op_1",
      labId: dummyLab.id,
      seed: "seed_xyz",
      mode: "practice",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: new Date().toISOString(),
      expiresAt: null,
      completedAt: null,
      failedAt: null,
    };

    const rawEnv: LabEnv = {
      kind: "webapp",
      app: {
        appId: "sqli_portal",
        name: "Apex Vault",
        baseUrl: "http://apex-vault.internal",
        initialUrl: "http://apex-vault.internal/login",
        database: {},
        config: {
          adminToken: "super_secret",
          flags: {
            flag_auth_bypass: "CYBERBLADE{secret_flag}",
          },
        },
      },
    };

    const session = toSession(dummyLab, dummyAttempt, rawEnv);
    expect(session.attemptId).toBe("att_123");
    if (session.env.kind === "webapp") {
      expect(session.env.app.config).not.toHaveProperty("flags");
      expect(session.env.app.config).not.toHaveProperty("adminToken");
    }
  });

  it("throttles rapid submission brute force attempts via sliding-window rate limit", () => {
    resetSubmissionRateLimits();
    const operatorId = "op_attacker_99";
    const key = `sub:${operatorId}`;

    // First 10 submissions in window are allowed
    for (let i = 0; i < 10; i++) {
      const res = checkSubmissionRateLimit(key, 10, 10_000);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(9 - i);
    }

    // 11th submission is blocked
    const throttled = checkSubmissionRateLimit(key, 10, 10_000);
    expect(throttled.allowed).toBe(false);
    expect(throttled.remaining).toBe(0);
    expect(throttled.retryAfterMs).toBeGreaterThan(0);
  });
});

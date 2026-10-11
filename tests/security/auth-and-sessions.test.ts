import { describe, it, expect, beforeEach, vi } from "vitest";
import { safeNextPath } from "@/lib/identity/routes";
import { handleSchema, isReservedHandle, RESERVED_HANDLE_ERROR } from "@/lib/identity/validation";
import { checkRateLimit, resetSubmissionRateLimits } from "@/lib/progress/rate-limit";

describe("Security Part C: Authentication, Sessions & Open Redirect Defense", () => {
  beforeEach(() => {
    resetSubmissionRateLimits();
  });

  describe("Open Redirect Protection (safeNextPath)", () => {
    const maliciousPaths = [
      "https://attacker.com",
      "http://attacker.com/steal",
      "//attacker.com",
      "//attacker.com/dashboard",
      "/\\attacker.com",
      "/\\/attacker.com",
      "/\t/attacker.com",
      "/\n/attacker.com",
      "/\r/attacker.com",
      " //attacker.com",
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "",
      null,
      undefined,
    ];

    it.each(maliciousPaths)("sanitizes hostile redirect target %j to /dashboard", (hostile) => {
      expect(safeNextPath(hostile as any)).toBe("/dashboard");
    });

    it("preserves valid same-origin relative paths with query parameters and anchors", () => {
      expect(safeNextPath("/dashboard")).toBe("/dashboard");
      expect(safeNextPath("/learn/core")).toBe("/learn/core");
      expect(safeNextPath("/labs/core-r0-terminal-lab-01?lesson=01#tab-checks")).toBe(
        "/labs/core-r0-terminal-lab-01?lesson=01#tab-checks"
      );
    });
  });

  describe("Handle Validation & Staff Impersonation Defense", () => {
    it.each(["admin", "root", "system", "cyberblade", "handler", "support", "moderator", "staff"])(
      "rejects registration of reserved handle '%s'",
      (reserved) => {
        expect(isReservedHandle(reserved)).toBe(true);
        const result = handleSchema.safeParse(reserved);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(RESERVED_HANDLE_ERROR);
      }
    );

    it.each(["ADMIN", "Root", "SyStEm", "CyberBlade"])(
      "rejects case-insensitive variants of reserved handle '%s'",
      (variant) => {
        const result = handleSchema.safeParse(variant);
        expect(result.success).toBe(false);
      }
    );

    it("rejects malicious characters or script tags in handles", () => {
      expect(handleSchema.safeParse("<script>alert(1)</script>").success).toBe(false);
      expect(handleSchema.safeParse("user%20name").success).toBe(false);
      expect(handleSchema.safeParse("user;drop table").success).toBe(false);
      expect(handleSchema.safeParse("a").success).toBe(false); // too short
      expect(handleSchema.safeParse("a".repeat(25)).success).toBe(false); // too long
    });

    it("accepts valid alphanumeric handles with underscores", () => {
      expect(handleSchema.safeParse("ghost_operator").success).toBe(true);
      expect(handleSchema.safeParse("blaze_03").success).toBe(true);
      expect(handleSchema.safeParse("cadet_99").success).toBe(true);
    });
  });

  describe("Brute-Force & Abuse Rate Limiting", () => {
    it("throttles rapid sequential requests to protected action keys", () => {
      const key = "test:rapid:user-1";
      // Allow up to 3 within 10 seconds
      for (let i = 0; i < 3; i++) {
        const res = checkRateLimit(key, 3, 10_000);
        expect(res.allowed).toBe(true);
      }

      // 4th request must be throttled
      const throttled = checkRateLimit(key, 3, 10_000);
      expect(throttled.allowed).toBe(false);
      expect(throttled.remaining).toBe(0);
      expect(throttled.retryAfterMs).toBeGreaterThan(0);
    });

    it("differentiates between distinct operators/IPs", () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit("ip:192.168.1.1", 3, 10_000);
      }
      expect(checkRateLimit("ip:192.168.1.1", 3, 10_000).allowed).toBe(false);
      expect(checkRateLimit("ip:192.168.1.2", 3, 10_000).allowed).toBe(true);
    });
  });
});

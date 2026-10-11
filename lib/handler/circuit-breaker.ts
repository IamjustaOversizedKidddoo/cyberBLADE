/**
 * Circuit breaker for external AI model providers (Groq, Gemini).
 * Skips failing or rate-limited providers during a cooldown period to ensure fast fallback.
 */

export type CircuitBreakerConfig = {
  failureThreshold: number;
  cooldownMs: number;
};

export class ProviderCircuitBreaker {
  private failureCount = 0;
  private openUntil = 0;

  constructor(
    private readonly config: CircuitBreakerConfig = { failureThreshold: 3, cooldownMs: 60_000 },
  ) {}

  isOpen(now = Date.now()): boolean {
    return this.openUntil > now;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.openUntil = 0;
  }

  recordFailure(now = Date.now(), isQuotaOrRateLimit = false): void {
    this.failureCount++;
    // If rate-limited or quota exceeded, trip circuit immediately
    if (isQuotaOrRateLimit || this.failureCount >= this.config.failureThreshold) {
      this.openUntil = now + this.config.cooldownMs;
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.openUntil = 0;
  }

  getStatus(now = Date.now()): { isOpen: boolean; failures: number; remainingCooldownMs: number } {
    const remaining = Math.max(0, this.openUntil - now);
    return {
      isOpen: remaining > 0,
      failures: this.failureCount,
      remainingCooldownMs: remaining,
    };
  }
}

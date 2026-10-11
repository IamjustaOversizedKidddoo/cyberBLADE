/**
 * In-memory sliding-window rate limiter for flag and answer submissions.
 * Prevents brute-force guessing and submission flooding.
 */

type SubmissionRecord = {
  timestamps: number[];
};

const records = new Map<string, SubmissionRecord>();

// Default limit: max 10 submissions within a 10-second sliding window per operator/action
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 10;

const MAX_ENTRIES = 10_000;

/**
 * Checks whether the given key has exceeded the rate limit.
 * Returns true if allowed, false if throttled.
 */
export function checkRateLimit(
  key: string,
  maxPerWindow = MAX_PER_WINDOW,
  windowMs = WINDOW_MS,
  now = Date.now(),
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  // Prevent unbounded memory growth under adversarial key generation
  if (records.size > MAX_ENTRIES) {
    const oldestAllowed = now - 60_000;
    for (const [k, v] of records.entries()) {
      if (!v.timestamps.some((t) => t > oldestAllowed)) {
        records.delete(k);
      }
    }
  }

  let rec = records.get(key);
  if (!rec) {
    rec = { timestamps: [] };
    records.set(key, rec);
  }

  // Prune timestamps older than windowMs
  const cutoff = now - windowMs;
  rec.timestamps = rec.timestamps.filter((t) => t > cutoff);

  if (rec.timestamps.length >= maxPerWindow) {
    const oldestInWindow = rec.timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, oldestInWindow + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  rec.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxPerWindow - rec.timestamps.length,
  };
}

export const checkSubmissionRateLimit = checkRateLimit;

/** Resets rate limits (primarily for testing). */
export function resetSubmissionRateLimits(): void {
  records.clear();
}

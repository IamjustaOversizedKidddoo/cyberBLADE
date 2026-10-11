/**
 * In-memory TTL cache for deterministic hint responses.
 * Avoids redundant LLM calls when learners request identical hints for the same objective/tier state.
 */

type CacheEntry = {
  reply: string;
  expiresAt: number;
};

const hintCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export function buildHintCacheKey(objectiveId: string, tier: number, stateHash: string): string {
  return `hint:${objectiveId}:t${tier}:${stateHash}`;
}

export function getCachedHint(key: string, now = Date.now()): string | null {
  const entry = hintCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    hintCache.delete(key);
    return null;
  }
  return entry.reply;
}

export function setCachedHint(
  key: string,
  reply: string,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
): void {
  hintCache.set(key, {
    reply,
    expiresAt: now + ttlMs,
  });
}

export function clearHintCache(): void {
  hintCache.clear();
}

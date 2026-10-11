/**
 * Handler abuse prevention, per-user/IP rate limiting, and double-click idempotency guard.
 */

type RequestRecord = {
  timestamps: number[];
  lastHash?: string;
  lastResponse?: { reply: string; timestamp: number };
};

const userRecords = new Map<string, RequestRecord>();

// Default rate limits: 15 requests per 60-second window per user/IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;
const IDEMPOTENCY_WINDOW_MS = 2_500; // Double-click suppression window

export function checkHandlerAbuse(
  key: string,
  message: string,
  now = Date.now(),
): {
  allowed: boolean;
  isDuplicate: boolean;
  cachedReply?: string;
  retryAfterSeconds: number;
} {
  let rec = userRecords.get(key);
  if (!rec) {
    rec = { timestamps: [] };
    userRecords.set(key, rec);
  }

  // Prune older timestamps
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  rec.timestamps = rec.timestamps.filter((t) => t > cutoff);

  // Fast hash of message to catch rapid double-clicks
  const msgHash = `${message.trim().toLowerCase()}`;
  if (
    rec.lastHash === msgHash &&
    rec.lastResponse &&
    now - rec.lastResponse.timestamp < IDEMPOTENCY_WINDOW_MS
  ) {
    return {
      allowed: true,
      isDuplicate: true,
      cachedReply: rec.lastResponse.reply,
      retryAfterSeconds: 0,
    };
  }

  if (rec.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = rec.timestamps[0] ?? now;
    const retryAfter = Math.ceil(Math.max(0, oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      isDuplicate: false,
      retryAfterSeconds: retryAfter,
    };
  }

  rec.timestamps.push(now);
  rec.lastHash = msgHash;

  return {
    allowed: true,
    isDuplicate: false,
    retryAfterSeconds: 0,
  };
}

export function recordHandlerResponseForDeduplication(
  key: string,
  reply: string,
  now = Date.now(),
): void {
  const rec = userRecords.get(key);
  if (rec) {
    rec.lastResponse = { reply, timestamp: now };
  }
}

export function resetHandlerAbuseRecords(): void {
  userRecords.clear();
}

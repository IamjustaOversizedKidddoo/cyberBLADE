import { createJsonStore, dataPath, type JsonStore } from "@/lib/storage/json-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SupabaseHandlerUsageStore } from "./supabase-usage-store";

export type HandlerDailyUsage = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  lastRequestAt: string;
};

export type HandlerUsageStoreData = {
  records: Record<string, HandlerDailyUsage>;
};

export interface HandlerUsageStore {
  getUsage(userId: string, dateStr: string): Promise<HandlerDailyUsage>;
  recordUsage(userId: string, dateStr: string, inputTokens: number, outputTokens: number): Promise<HandlerDailyUsage>;
}

export class FileHandlerUsageStore implements HandlerUsageStore {
  private store: JsonStore<HandlerUsageStoreData>;

  constructor(filePath = dataPath("handler-usage.json")) {
    this.store = createJsonStore<HandlerUsageStoreData>(filePath, () => ({ records: {} }));
  }

  async getUsage(userId: string, dateStr: string): Promise<HandlerDailyUsage> {
    const data = await this.store.read();
    const key = `${userId}:${dateStr}`;
    return data.records[key] ?? { requests: 0, inputTokens: 0, outputTokens: 0, lastRequestAt: "" };
  }

  async recordUsage(
    userId: string,
    dateStr: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<HandlerDailyUsage> {
    const key = `${userId}:${dateStr}`;
    const nowIso = new Date().toISOString();
    let updated: HandlerDailyUsage = { requests: 0, inputTokens: 0, outputTokens: 0, lastRequestAt: nowIso };

    await this.store.update((draft) => {
      const existing = draft.records[key] ?? {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        lastRequestAt: nowIso,
      };
      existing.requests += 1;
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.lastRequestAt = nowIso;
      draft.records[key] = existing;
      updated = existing;
    });

    return updated;
  }
}

export class MemoryHandlerUsageStore implements HandlerUsageStore {
  private records: Map<string, HandlerDailyUsage> = new Map();

  async getUsage(userId: string, dateStr: string): Promise<HandlerDailyUsage> {
    const key = `${userId}:${dateStr}`;
    return this.records.get(key) ?? { requests: 0, inputTokens: 0, outputTokens: 0, lastRequestAt: "" };
  }

  async recordUsage(
    userId: string,
    dateStr: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<HandlerDailyUsage> {
    const key = `${userId}:${dateStr}`;
    const nowIso = new Date().toISOString();
    const existing = this.records.get(key) ?? {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      lastRequestAt: nowIso,
    };
    existing.requests += 1;
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    existing.lastRequestAt = nowIso;
    this.records.set(key, existing);
    return existing;
  }
}

// Hosted: Postgres (atomic, shared by every serverless instance). The file store is local only;
// on Vercel the filesystem is read-only, so file-based metering would silently enforce nothing.
let override: HandlerUsageStore | null = null;
let hostedOrFile: HandlerUsageStore | null = null;
const activeStoreRef = (): HandlerUsageStore => {
  if (override) return override;
  hostedOrFile ??= isSupabaseConfigured() ? new SupabaseHandlerUsageStore() : new FileHandlerUsageStore();
  return hostedOrFile;
};
const activeStore: HandlerUsageStore = {
  getUsage: (u, d) => activeStoreRef().getUsage(u, d),
  recordUsage: (u, d, i, o) => activeStoreRef().recordUsage(u, d, i, o),
};

export function setHandlerUsageStore(store: HandlerUsageStore): void {
  override = store;
}

export function getHandlerUsageStore(): HandlerUsageStore {
  return activeStoreRef();
}

export function getTodayDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const GLOBAL_USER_ID = "__global_daily_ceiling__";

export async function checkGlobalDailySpendCeiling(now = new Date()): Promise<boolean> {
  const maxTokens = Number(process.env.HANDLER_GLOBAL_DAILY_TOKEN_LIMIT) || 500_000;
  const dateStr = getTodayDateString(now);
  const globalUsage = await activeStore.getUsage(GLOBAL_USER_ID, dateStr);
  const totalTokens = globalUsage.inputTokens + globalUsage.outputTokens;
  return totalTokens >= maxTokens;
}

export async function checkDailyQuota(
  userId: string,
  now = new Date(),
): Promise<{
  allowed: boolean;
  quotaExceeded: boolean;
  usage: HandlerDailyUsage;
  limits: { maxRequests: number; maxTokens: number };
}> {
  const maxRequests = Number(process.env.HANDLER_DAILY_REQUEST_LIMIT) || 50;
  const maxTokens = Number(process.env.HANDLER_DAILY_TOKEN_LIMIT) || 50_000;

  const dateStr = getTodayDateString(now);
  const usage = await activeStore.getUsage(userId, dateStr);

  const totalTokens = usage.inputTokens + usage.outputTokens;
  const globalExceeded = await checkGlobalDailySpendCeiling(now);
  const quotaExceeded = usage.requests >= maxRequests || totalTokens >= maxTokens || globalExceeded;

  return {
    allowed: !quotaExceeded,
    quotaExceeded,
    usage,
    limits: { maxRequests, maxTokens },
  };
}

export async function recordHandlerUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number,
  now = new Date(),
): Promise<HandlerDailyUsage> {
  const dateStr = getTodayDateString(now);
  const userUsage = await activeStore.recordUsage(userId, dateStr, inputTokens, outputTokens);
  await activeStore.recordUsage(GLOBAL_USER_ID, dateStr, inputTokens, outputTokens);
  return userUsage;
}

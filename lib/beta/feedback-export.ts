/** Groups feedback by content item (newest first) and replaces learner ids with per-export pseudonyms. */
import { createHash } from "node:crypto";
import type { FeedbackRecord } from "./store";

export function groupFeedback(rows: FeedbackRecord[], salt: string) {
  const pseudo = (id: string) => createHash("sha256").update(salt + id).digest("hex").slice(0, 8);
  const groups = new Map<string, Array<{ learner: string; route: string; message: string; requestId: string; createdAt: string }>>();
  for (const r of rows) {
    const key = `${r.kind}${r.contentId ? `:${r.contentId}` : ""}`;
    const list = groups.get(key) ?? [];
    list.push({ learner: pseudo(r.userId), route: r.route, message: r.message, requestId: r.requestId, createdAt: r.createdAt });
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([item, entries]) => ({ item, count: entries.length, entries: entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
    .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}

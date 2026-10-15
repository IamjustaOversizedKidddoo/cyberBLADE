/**
 * Knowledge exam bank: schema, seeded draw, learner view and grading. Answers stay on the server;
 * the learner sees options under per-exam opaque ids, so an option id from one exam says nothing
 * about another.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const KNOWLEDGE_ITEM_TYPES = ["mcq", "multi", "ordering", "log"] as const;

const itemSchema = z
  .object({
    id: z.string().regex(/^kb-[a-z0-9-]+$/),
    type: z.enum(KNOWLEDGE_ITEM_TYPES),
    skill: z.string().regex(/^soc_[a-z_]+$/),
    claim: z.string().regex(/^K\d+$/),
    stem: z.string().min(10),
    log: z.string().optional(),
    options: z.array(z.string().min(1)).min(2).max(8),
    answer: z.array(z.number().int().min(0)).min(1),
    explanation: z.string().min(20),
  })
  .superRefine((it, c) => {
    const n = it.options.length;
    if (it.answer.some((a) => a >= n)) c.addIssue({ code: "custom", message: `${it.id}: answer index out of range` });
    if (new Set(it.answer).size !== it.answer.length) c.addIssue({ code: "custom", message: `${it.id}: duplicate answer index` });
    if ((it.type === "mcq" || it.type === "log") && it.answer.length !== 1) c.addIssue({ code: "custom", message: `${it.id}: single-answer item needs exactly one answer` });
    if (it.type === "ordering" && it.answer.length !== n) c.addIssue({ code: "custom", message: `${it.id}: ordering answer must list every option` });
    if (it.type === "log" && !it.log) c.addIssue({ code: "custom", message: `${it.id}: log item needs a log` });
    if (new Set(it.options).size !== n) c.addIssue({ code: "custom", message: `${it.id}: duplicate options` });
  });

export const knowledgeBankSchema = z
  .object({
    version: z.number().int(),
    objectiveAlignment: z.literal("UNVERIFIED"),
    status: z.string(),
    items: z.array(itemSchema).min(1),
  })
  .refine((b) => new Set(b.items.map((i) => i.id)).size === b.items.length, "duplicate item ids");

export type KnowledgeBank = z.infer<typeof knowledgeBankSchema>;
export type KnowledgeItem = KnowledgeBank["items"][number];

/** What the learner sees: no answer, no explanation, no claim reference. */
export type KnowledgeItemView = {
  id: string;
  type: KnowledgeItem["type"];
  stem: string;
  log: string | null;
  options: Array<{ id: string; text: string }>;
};

/** A learner answer: chosen option ids (mcq/log: one; multi: any; ordering: all, in order). */
export type KnowledgeAnswer = string[];

let cached: KnowledgeBank | null = null;
export function loadKnowledgeBank(file = "content/soc/exams/knowledge-bank.yaml"): KnowledgeBank {
  if (cached && file === "content/soc/exams/knowledge-bank.yaml") return cached;
  const bank = knowledgeBankSchema.parse(parseYaml(fs.readFileSync(path.resolve(file), "utf8")));
  if (file === "content/soc/exams/knowledge-bank.yaml") cached = bank;
  return bank;
}

function h(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

/** Stable seeded order of `values` (sort by keyed hash). */
function seededOrder<T>(values: T[], seed: string, key: (v: T, i: number) => string): T[] {
  return values
    .map((v, i) => ({ v, k: h(seed, key(v, i)) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.v);
}

/**
 * Draws `count` items: items this learner has not seen yet come first (in seeded order), then
 * the least recently seen. `seen` lists item ids from earlier exams, oldest first.
 */
export function drawKnowledgeItems(bank: KnowledgeBank, count: number, seed: string, seen: string[]): string[] {
  const lastSeen = new Map<string, number>();
  seen.forEach((id, i) => lastSeen.set(id, i));
  const ordered = seededOrder(bank.items, seed, (it) => it.id);
  const unseen = ordered.filter((it) => !lastSeen.has(it.id));
  const seenItems = ordered.filter((it) => lastSeen.has(it.id)).sort((a, b) => lastSeen.get(a.id)! - lastSeen.get(b.id)!);
  return [...unseen, ...seenItems].slice(0, Math.min(count, bank.items.length)).map((it) => it.id);
}

const optionId = (seed: string, itemId: string, index: number) => `o${h("opt", seed, itemId, String(index)).slice(0, 10)}`;

export function knowledgeItemView(item: KnowledgeItem, seed: string): KnowledgeItemView {
  const options = item.options.map((text, i) => ({ id: optionId(seed, item.id, i), text }));
  return { id: item.id, type: item.type, stem: item.stem, log: item.log ?? null, options: seededOrder(options, seed, (o) => `${item.id}:${o.id}`) };
}

/** Maps option ids back to indices; unknown ids make the answer wrong, never an error. */
export function gradeKnowledgeAnswer(item: KnowledgeItem, seed: string, answer: KnowledgeAnswer | null): boolean {
  if (!answer || answer.length === 0) return false;
  const byId = new Map(item.options.map((_, i) => [optionId(seed, item.id, i), i]));
  const picked = answer.map((id) => byId.get(id));
  if (picked.some((i) => i === undefined)) return false;
  const idx = picked as number[];
  if (item.type === "ordering") return idx.length === item.answer.length && idx.every((v, i) => v === item.answer[i]);
  if (new Set(idx).size !== idx.length) return false;
  const want = new Set(item.answer);
  return idx.length === want.size && idx.every((i) => want.has(i));
}

/** Post-submission review for the learner's own exam: correct option ids and the explanation. */
export function knowledgeItemReview(item: KnowledgeItem, seed: string) {
  return { correctOptionIds: item.answer.map((i) => optionId(seed, item.id, i)), explanation: item.explanation };
}

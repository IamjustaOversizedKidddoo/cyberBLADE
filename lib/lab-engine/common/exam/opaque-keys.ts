/**
 * Keyed HMAC/hash utilities for obfuscating exam item IDs and option IDs.
 * Prevents answer sharing and client-side inspection.
 */
import { createHash } from "node:crypto";

export function hashParts(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

/** Stable seeded order of `values` (sort by keyed hash). */
export function seededOrder<T>(values: T[], seed: string, key: (v: T, i: number) => string): T[] {
  return values
    .map((v, i) => ({ v, k: hashParts(seed, key(v, i)) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.v);
}

/**
 * Opaque per-exam key for an item. Bank IDs or scenario names never leave the server;
 * the client and export only see this key.
 */
export function examItemKey(seed: string, itemId: string): string {
  return `q${hashParts("item", seed, itemId).slice(0, 12)}`;
}

/**
 * Opaque per-exam key for an option index.
 */
export function optionId(seed: string, itemId: string, index: number): string {
  return `o${hashParts("opt", seed, itemId, String(index)).slice(0, 10)}`;
}

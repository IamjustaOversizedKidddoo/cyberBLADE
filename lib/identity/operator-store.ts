import type { Operator } from "./types";
import { FileOperatorStore } from "./file-operator-store";
import { SupabaseOperatorStore } from "./supabase-operator-store";
import { assertSafeStorageMode, isSupabaseConfigured } from "@/lib/supabase/config";

export interface OperatorStore {
  get(id: string): Promise<Operator | null>;
  create(input: { handle: string; ethicsAcceptedAt: string; id?: string }): Promise<Operator>;
  setRank(id: string, rank: number): Promise<void>;
}

// Single swap point: hosted uses Supabase, local-first falls back to FileOperatorStore.
export function getOperatorStore(): OperatorStore {
  assertSafeStorageMode();
  if (isSupabaseConfigured()) {
    return new SupabaseOperatorStore();
  }
  return new FileOperatorStore();
}

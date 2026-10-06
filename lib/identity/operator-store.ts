import type { Operator } from "./types";
import { FileOperatorStore } from "./file-operator-store";

export interface OperatorStore {
  get(id: string): Promise<Operator | null>;
  create(input: { handle: string; ethicsAcceptedAt: string }): Promise<Operator>;
  setRank(id: string, rank: number): Promise<void>;
}

// Single swap point: the hosted phase replaces this with a Supabase-backed store.
export function getOperatorStore(): OperatorStore {
  return new FileOperatorStore();
}

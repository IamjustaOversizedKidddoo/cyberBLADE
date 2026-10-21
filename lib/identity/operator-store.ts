import { randomUUID } from "node:crypto";
import type { Operator } from "./types";
import { FileOperatorStore } from "./file-operator-store";
import { isAllContentUnlocked } from "../progress/access";

export interface OperatorStore {
  get(id: string): Promise<Operator | null>;
  create(input: { handle: string; ethicsAcceptedAt: string | null; id?: string }): Promise<Operator>;
  setRank(id: string, rank: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export class ResilientOperatorStore implements OperatorStore {
  private static memory = new Map<string, Operator>();
  private fileStore = new FileOperatorStore();

  async get(id: string): Promise<Operator | null> {
    if (ResilientOperatorStore.memory.has(id)) {
      const op = ResilientOperatorStore.memory.get(id)!;
      if (isAllContentUnlocked() && op.rank < 2) op.rank = 2;
      return op;
    }
    try {
      const op = await this.fileStore.get(id);
      if (op) {
        if (isAllContentUnlocked() && op.rank < 2) op.rank = 2;
        ResilientOperatorStore.memory.set(id, op);
        return op;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async create(input: { handle: string; ethicsAcceptedAt: string | null; id?: string }): Promise<Operator> {
    const id = input.id ?? randomUUID();
    const rank = isAllContentUnlocked() ? 2 : 0;
    const op: Operator = {
      id,
      handle: input.handle,
      rank,
      ethicsAcceptedAt: input.ethicsAcceptedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    ResilientOperatorStore.memory.set(id, op);
    try {
      await this.fileStore.create({ id, handle: input.handle, ethicsAcceptedAt: op.ethicsAcceptedAt! });
    } catch {
      // file system errors safely ignored
    }
    return op;
  }

  async setRank(id: string, rank: number): Promise<void> {
    const op = ResilientOperatorStore.memory.get(id);
    if (op) op.rank = rank;
    try {
      await this.fileStore.setRank(id, rank);
    } catch {}
  }

  async delete(id: string): Promise<void> {
    ResilientOperatorStore.memory.delete(id);
    try {
      await this.fileStore.delete(id);
    } catch {}
  }
}

let cachedStore: OperatorStore | null = null;

export function getOperatorStore(): OperatorStore {
  if (!cachedStore) {
    cachedStore = new ResilientOperatorStore();
  }
  return cachedStore;
}


import { randomUUID } from "node:crypto";
import { createJsonStore, dataPath, type JsonStore } from "@/lib/storage/json-store";
import type { OperatorStore } from "./operator-store";
import type { Operator } from "./types";

type OperatorsFile = { operators: Record<string, Operator> };

export class FileOperatorStore implements OperatorStore {
  private store: JsonStore<OperatorsFile>;

  constructor(filePath = dataPath("operators.json")) {
    this.store = createJsonStore<OperatorsFile>(filePath, () => ({ operators: {} }));
  }

  async get(id: string): Promise<Operator | null> {
    const data = await this.store.read();
    return data.operators[id] ?? null;
  }

  async create(input: { handle: string; ethicsAcceptedAt: string; id?: string }): Promise<Operator> {
    const operator: Operator = {
      // A caller-chosen id lets an invite be redeemed for the account before it is created.
      id: input.id ?? randomUUID(),
      handle: input.handle,
      rank: 0,
      ethicsAcceptedAt: input.ethicsAcceptedAt,
      createdAt: new Date().toISOString(),
    };
    await this.store.update((d) => {
      d.operators[operator.id] = operator;
    });
    return operator;
  }

  async setRank(id: string, rank: number): Promise<void> {
    await this.store.update((d) => {
      const op = d.operators[id];
      if (op) op.rank = rank;
    });
  }

  async delete(id: string): Promise<void> {
    await this.store.update((d) => {
      delete d.operators[id];
    });
  }
}

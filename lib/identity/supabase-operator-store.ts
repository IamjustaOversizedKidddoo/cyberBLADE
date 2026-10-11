import "server-only";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OperatorStore } from "./operator-store";
import type { Operator } from "./types";

export class SupabaseOperatorStore implements OperatorStore {
  async get(id: string): Promise<Operator | null> {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("operators")
      .select("id, handle, rank, ethics_accepted_at, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      handle: data.handle,
      rank: data.rank,
      ethicsAcceptedAt: data.ethics_accepted_at,
      createdAt: data.created_at,
    };
  }

  async create(input: { handle: string; ethicsAcceptedAt: string; id?: string }): Promise<Operator> {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminClient();
    const client = admin ?? supabase;
    if (!client) throw new Error("Supabase client is not available.");

    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();

    const { data, error } = await client
      .from("operators")
      .insert({
        id,
        handle: input.handle,
        rank: 0,
        ethics_accepted_at: input.ethicsAcceptedAt,
        created_at: createdAt,
      })
      .select("id, handle, rank, ethics_accepted_at, created_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create operator in Supabase: ${error?.message}`);
    }

    return {
      id: data.id,
      handle: data.handle,
      rank: data.rank,
      ethicsAcceptedAt: data.ethics_accepted_at,
      createdAt: data.created_at,
    };
  }

  async setRank(id: string, rank: number): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminClient();
    const client = admin ?? supabase;
    if (!client) throw new Error("Supabase client is not available.");

    const { error } = await client
      .from("operators")
      .update({ rank })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to update operator rank in Supabase: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminClient();
    const client = admin ?? supabase;
    if (!client) throw new Error("Supabase client is not available.");

    const { error } = await client.from("operators").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete operator in Supabase: ${error.message}`);
    }
  }
}

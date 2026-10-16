import "server-only";
/**
 * Hosted beta store (service-role client; RLS keeps learner reads own-rows only). Redemption is
 * the atomic SQL function `beta_redeem_invite` (migration 20261016120000).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BetaInvite, BetaStore, FeedbackRecord } from "./store";

type Row = Record<string, unknown>;
const client = (): SupabaseClient => {
  const c = createAdminClient();
  if (!c) throw new Error("Supabase is not configured.");
  return c as unknown as SupabaseClient;
};
function check<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`beta store: ${what} failed`);
  return r.data;
}
const invite = (r: Row): BetaInvite => ({
  id: r.id as string,
  codeHash: r.code_hash as string,
  label: r.label as string,
  maxUses: Number(r.max_uses),
  uses: Number(r.uses),
  expiresAt: new Date(r.expires_at as string).toISOString(),
  revokedAt: r.revoked_at ? new Date(r.revoked_at as string).toISOString() : null,
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string).toISOString(),
});
const feedback = (r: Row): FeedbackRecord => ({
  id: r.id as string,
  userId: r.user_id as string,
  kind: r.kind as FeedbackRecord["kind"],
  contentId: r.content_id as string,
  route: r.route as string,
  message: r.message as string,
  requestId: r.request_id as string,
  createdAt: new Date(r.created_at as string).toISOString(),
});

export class SupabaseBetaStore implements BetaStore {
  constructor(private readonly c: () => SupabaseClient = client) {}

  async createInvite(input: Omit<BetaInvite, "id" | "uses" | "revokedAt" | "createdAt">) {
    const row = check(
      await this.c().from("beta_invites").insert({ code_hash: input.codeHash, label: input.label, max_uses: input.maxUses, expires_at: input.expiresAt, created_by: input.createdBy }).select("*").single(),
      "create invite",
    );
    return invite(row as Row);
  }
  async listInvites() {
    return (check(await this.c().from("beta_invites").select("*").order("created_at"), "list invites") as Row[]).map(invite);
  }
  async revokeInvite(id: string, at: string) {
    const rows = check(await this.c().from("beta_invites").update({ revoked_at: at }).eq("id", id).is("revoked_at", null).select("id"), "revoke invite") as Row[];
    return rows.length > 0;
  }
  async inviteUsable(codeHash: string, now: string) {
    const r = check(await this.c().from("beta_invites").select("uses, max_uses, expires_at, revoked_at").eq("code_hash", codeHash).maybeSingle(), "check invite") as Row | null;
    return !!r && !r.revoked_at && new Date(r.expires_at as string).toISOString() > now && Number(r.uses) < Number(r.max_uses);
  }
  async redeemInvite(codeHash: string, userId: string, now: string) {
    return Boolean(check(await this.c().rpc("beta_redeem_invite", { p_code_hash: codeHash, p_user_id: userId, p_now: now }), "redeem invite"));
  }
  async isAdmitted(userId: string) {
    return Boolean(check(await this.c().from("beta_invite_redemptions").select("id").eq("user_id", userId).maybeSingle(), "admitted"));
  }
  async hasAckedNotice(userId: string, version: string) {
    return Boolean(check(await this.c().from("beta_notice_acks").select("user_id").eq("user_id", userId).eq("notice_version", version).maybeSingle(), "notice ack"));
  }
  async ackNotice(userId: string, version: string, at: string) {
    check(await this.c().from("beta_notice_acks").upsert({ user_id: userId, notice_version: version, acked_at: at }, { onConflict: "user_id,notice_version", ignoreDuplicates: true }), "ack notice");
  }
  async saveFeedback(input: Omit<FeedbackRecord, "id" | "createdAt">, at: string) {
    const row = check(
      await this.c().from("learner_feedback").insert({ user_id: input.userId, kind: input.kind, content_id: input.contentId, route: input.route, message: input.message, request_id: input.requestId, created_at: at }).select("*").single(),
      "save feedback",
    );
    return feedback(row as Row);
  }
  async listFeedback() {
    return (check(await this.c().from("learner_feedback").select("*").order("created_at"), "list feedback") as Row[]).map(feedback);
  }
  async listFeedbackForUser(userId: string) {
    return (check(await this.c().from("learner_feedback").select("*").eq("user_id", userId).order("created_at"), "list own feedback") as Row[]).map(feedback);
  }
  async noticeAcksForUser(userId: string) {
    return (check(await this.c().from("beta_notice_acks").select("notice_version, acked_at").eq("user_id", userId), "own acks") as Row[]).map((r) => ({ version: r.notice_version as string, ackedAt: new Date(r.acked_at as string).toISOString() }));
  }
  async deleteUser() {
    // Hosted deletion runs in delete_user_account (migration 20261016120000).
  }
}

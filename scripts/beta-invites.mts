/**
 * Admin CLI for closed-beta invite codes. Codes are printed ONCE at creation; only their hash is
 * stored. Every change is audit-logged (JSON lines in <data>/audit/beta-invites.log, and the
 * audit_events table in hosted mode).
 *
 *   npm run beta:invites -- create --uses 1 --days 14 --label "cohort A" --by owner [--count 10]
 *   npm run beta:invites -- list
 *   npm run beta:invites -- revoke --id <invite-id> --by owner
 *   add --hosted to use Supabase (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the
 *   environment; run from your machine, never from CI).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { FileBetaStore, type BetaStore } from "../lib/beta/store.js";
import { generateInviteCode, hashInviteCode, normalizeInviteCode } from "../lib/beta/codes.js";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function store(): Promise<BetaStore> {
  if (!process.argv.includes("--hosted")) return new FileBetaStore();
  const { SupabaseBetaStore } = await import("../lib/beta/supabase-store.js");
  return new SupabaseBetaStore();
}

async function audit(entry: Record<string, unknown>) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  const file = path.join(process.env.NEON_DATA_DIR ?? ".data", "audit", "beta-invites.log");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, line + "\n");
  if (process.argv.includes("--hosted")) {
    const { logSecurityEvent } = await import("../lib/security/audit-logger.js");
    await logSecurityEvent({ userId: null, eventType: `beta.invite.${entry.action}`, severity: "info", metadata: entry });
  }
}

async function main() {
  const cmd = process.argv[2];
  const s = await store();
  if (cmd === "create") {
    const uses = Number(arg("uses") ?? 1);
    const days = Number(arg("days") ?? 14);
    const count = Number(arg("count") ?? 1);
    const by = arg("by");
    const label = (arg("label") ?? "").slice(0, 120);
    if (!by || !(uses >= 1 && uses <= 1000) || !(days >= 1 && days <= 90) || !(count >= 1 && count <= 200)) {
      console.error("Usage: create --by <admin> [--uses 1-1000] [--days 1-90] [--count 1-200] [--label text]");
      process.exit(1);
    }
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    console.log(`Creating ${count} code(s), ${uses} use(s) each, expiring ${expiresAt}. Codes are shown once:`);
    for (let i = 0; i < count; i++) {
      const code = generateInviteCode();
      const inv = await s.createInvite({ codeHash: hashInviteCode(normalizeInviteCode(code)!), label, maxUses: uses, expiresAt, createdBy: by });
      console.log(`  ${code}   (id ${inv.id})`);
      await audit({ action: "created", inviteId: inv.id, maxUses: uses, expiresAt, by, label });
    }
  } else if (cmd === "list") {
    const rows = await s.listInvites();
    for (const i of rows) console.log(`${i.id}  ${i.label.padEnd(20)}  uses ${i.uses}/${i.maxUses}  expires ${i.expiresAt}${i.revokedAt ? `  REVOKED ${i.revokedAt}` : ""}`);
    if (!rows.length) console.log("No invites.");
  } else if (cmd === "revoke") {
    const id = arg("id");
    const by = arg("by");
    if (!id || !by) {
      console.error("Usage: revoke --id <invite-id> --by <admin>");
      process.exit(1);
    }
    const ok = await s.revokeInvite(id, new Date().toISOString());
    await audit({ action: "revoked", inviteId: id, by, changed: ok });
    console.log(ok ? "Revoked." : "Not found or already revoked.");
  } else {
    console.error("Commands: create | list | revoke (see the header of scripts/beta-invites.mts)");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

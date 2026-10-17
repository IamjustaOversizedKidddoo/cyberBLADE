/**
 * Admin CLI script for certificate revocation.
 *
 * Usage:
 *   npx tsx scripts/revoke-certificate.mts --credential <cbl_slug> --reason "Honor code violation" [--hosted]
 */
import { isValidCredentialId } from "../lib/certificates/slug.js";
import { getCtx } from "../lib/progress/context.js";
import { logSecurityEvent } from "../lib/security/audit-logger.js";
import { isSupabaseConfigured } from "../lib/supabase/config.js";
import { createAdminClient } from "../lib/supabase/admin.js";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  const credentialId = arg("credential") ?? process.argv[2];
  const reason = arg("reason") ?? "Administrative revocation";
  const useHosted = process.argv.includes("--hosted") || (isSupabaseConfigured() && !process.env.USE_LOCAL_STORE);

  if (!credentialId || !isValidCredentialId(credentialId)) {
    console.error("Error: Missing or invalid --credential parameter (expected format: cbl_<32 hex chars>)");
    process.exit(1);
  }

  console.log(`[REVOKE] Initiating revocation for credential: ${credentialId}`);
  console.log(`[REVOKE] Reason: ${reason}`);
  console.log(`[REVOKE] Mode: ${useHosted ? "Hosted Supabase" : "Local Progress Store"}`);

  if (useHosted) {
    const admin = createAdminClient();
    if (!admin) {
      console.error("Error: Supabase admin client could not be initialized.");
      process.exit(1);
    }
    const { data, error } = await admin.rpc("revoke_certificate", {
      p_credential_id: credentialId,
      p_reason: reason,
    });
    if (error) {
      console.error(`Error revoking certificate in Supabase: ${error.message}`);
      process.exit(1);
    }
    if (!data) {
      console.error("Warning: No matching certificate was found with that credential ID.");
      process.exit(2);
    }
  } else {
    const ctx = getCtx();
    const success = await ctx.repo.revokeCertificate(credentialId, reason);
    if (!success) {
      console.error("Warning: No matching certificate was found with that credential ID.");
      process.exit(2);
    }
  }

  await logSecurityEvent({
    userId: null,
    eventType: "certificate.revoked",
    severity: "warning",
    metadata: { credential_id: credentialId, reason, revoked_via: "admin_cli" },
  });

  console.log(`[SUCCESS] Certificate ${credentialId} has been successfully revoked.`);
}

main().catch((err) => {
  console.error("Fatal error during revocation:", err);
  process.exit(1);
});

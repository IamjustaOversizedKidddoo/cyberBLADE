/**
 * Admin CLI: set (or switch off with 1) a learner's extended-time multiplier for SOC practice
 * exams. Default for everyone is no accommodation. Every change is appended to
 * .data/audit/soc-exam-accommodations.log (JSON lines) and printed.
 *
 *   npm run soc:exam-accommodation -- --user <userId> --multiplier 1.5 --reason "documented need" --by <admin>
 *   add --hosted to write to Supabase with SUPABASE_SERVICE_ROLE_KEY (owner only; never from CI).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildAccommodation } from "../lib/lab-engine/soc/exam/accommodation.js";
import { FileProgressRepo } from "../lib/progress/file-repo.js";
import * as examStore from "../lib/lab-engine/soc/exam/supabase-exam-store.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  let built;
  try {
    built = buildAccommodation({ userId: arg("user"), multiplier: Number(arg("multiplier")), reason: arg("reason"), setBy: arg("by") }, new Date());
  } catch (e) {
    console.error("Invalid input. Need --user, --multiplier (1-2; 1 = off), --reason (5-200 chars), --by.");
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  if (process.argv.includes("--hosted")) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("--hosted needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
    await examStore.setAccommodation(createClient(url, key, { auth: { persistSession: false } }), built.record);
  } else {
    await new FileProgressRepo().setSocExamAccommodation(built.record);
  }
  const log = path.join(process.env.NEON_DATA_DIR ?? ".data", "audit", "soc-exam-accommodations.log");
  await fs.mkdir(path.dirname(log), { recursive: true });
  await fs.appendFile(log, built.audit + "\n");
  console.log(`Saved. Audit: ${built.audit}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

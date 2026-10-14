/**
 * Static checks of the AI grading migration. No PostgreSQL instance is available in this
 * environment, so these tests prove the SQL TEXT encodes the access model; they do not prove
 * runtime behaviour (see docs/ops/progress.md human-verification list).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(path.resolve("supabase/migrations/20261014120000_phase_3_soc_ai_grading.sql"), "utf8");
const code = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

const TABLES = [
  "soc_ai_grading_jobs",
  "soc_ai_criterion_grades",
  "soc_ai_raw_outputs",
  "soc_ai_review_items",
  "soc_ai_human_review_requests",
  "soc_ai_calibration_consent",
  "soc_ai_usage_daily",
];
const LEARNER_READABLE = ["soc_ai_criterion_grades", "soc_ai_human_review_requests", "soc_ai_calibration_consent"];
const SERVICE_ONLY = TABLES.filter((t) => !LEARNER_READABLE.includes(t));

function policiesOn(table: string): string[] {
  return [...code.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.(\w+)\s+FOR (\w+)([\s\S]*?);/g)]
    .filter((m) => m[2] === table)
    .map((m) => `${m[3]}|${m[4]}`);
}

function tableBody(table: string): string {
  const m = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(code);
  if (!m) throw new Error(`table ${table} not found`);
  return m[1];
}

describe("AI grading migration access model (static)", () => {
  it("is additive and idempotent", () => {
    for (const t of TABLES) expect(code).toContain(`CREATE TABLE IF NOT EXISTS public.${t} (`);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b|\bALTER\s+TABLE\s+public\.(?!soc_ai_)\w+/i);
    for (const m of code.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.(\w+)/g)) {
      expect(code, `policy ${m[1]} must be dropped first`).toContain(`DROP POLICY IF EXISTS "${m[1]}" ON public.${m[2]};`);
    }
    expect(code).not.toMatch(/CREATE\s+FUNCTION/i); // only CREATE OR REPLACE
    expect(sql).toMatch(/NOT EXECUTED AGAINST A DATABASE/);
    expect(sql).toMatch(/ROLLBACK/);
  });

  it("enables RLS on every new table", () => {
    for (const t of TABLES) expect(code).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
  });

  it("gives learners nothing on service-only tables (no policies, privileges revoked)", () => {
    for (const t of SERVICE_ONLY) {
      expect(policiesOn(t), t).toEqual([]);
      expect(code).toMatch(new RegExp(`REVOKE ALL ON public\\.${t} FROM (PUBLIC, )?anon, authenticated;`));
      expect(code).not.toMatch(new RegExp(`GRANT [^;]* ON public\\.${t} TO`));
    }
  });

  it("locks raw model outputs down hardest: forced RLS, no policies, revoked from PUBLIC too", () => {
    expect(code).toContain("ALTER TABLE public.soc_ai_raw_outputs FORCE ROW LEVEL SECURITY;");
    expect(code).toContain("REVOKE ALL ON public.soc_ai_raw_outputs FROM PUBLIC, anon, authenticated;");
    expect(policiesOn("soc_ai_raw_outputs")).toEqual([]);
  });

  it("lets learners SELECT only their own rows on learner-readable tables, and never write", () => {
    for (const t of LEARNER_READABLE) {
      const ps = policiesOn(t);
      expect(ps.length, t).toBe(1);
      expect(ps[0]).toMatch(/^SELECT\|\s+TO authenticated\s+USING \(auth\.uid\(\) = user_id\)$/);
      expect(code).toContain(`GRANT SELECT ON public.${t} TO authenticated;`);
      expect(code).not.toMatch(new RegExp(`GRANT (INSERT|UPDATE|DELETE|ALL)[^;]* ON public\\.${t}`));
    }
  });

  it("keeps raw text and prompts out of every learner-readable table", () => {
    for (const t of LEARNER_READABLE) {
      expect(tableBody(t), t).not.toMatch(/\b(raw_text|raw_output|prompt_text|system_prompt|prompt_hash)\b/);
    }
    expect(tableBody("soc_ai_raw_outputs")).toMatch(/raw_text/);
  });

  it("restricts helper functions to the service role", () => {
    for (const fn of ["soc_ai_claim_jobs(INTEGER, INTEGER)", "soc_ai_add_usage(TEXT, INTEGER, BIGINT, BIGINT)"]) {
      expect(code).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
    }
    expect(code).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("cascades every row from auth.users so account deletion removes it", () => {
    for (const t of TABLES.filter((x) => x !== "soc_ai_usage_daily")) {
      expect(tableBody(t), t).toMatch(/user_id\s+UUID[^,\n]*REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    }
  });
});

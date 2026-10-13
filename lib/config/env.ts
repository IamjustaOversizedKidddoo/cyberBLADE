import "server-only";
import { z } from "zod";

/**
 * Validated server runtime configuration schema.
 * Defines and validates all environment variables used across CyberBLADE.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Storage & Content
  NEON_DATA_DIR: z.string().default(".data"),
  NEON_SHOW_DRAFTS: z.string().optional(),
  // Supabase Hosted Backend
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  // AI Handler Configuration
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  HANDLER_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(50),
  HANDLER_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(50_000),
  HANDLER_MAX_GLOBAL_DAILY_BUDGET_USD: z.coerce.number().positive().default(10.0),
  // Phase 3 SOC Track Feature Flag
  SOC_WORKSPACE_ENABLED: z.string().optional(),
  SOC_ENRICHMENT_ENABLED: z.string().optional(),
  SOC_QUERY_ENABLED: z.string().optional(),
});

export function isSocWorkspaceEnabled(): boolean {
  const flag = process.env.SOC_WORKSPACE_ENABLED;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  // Default on in development & test, off in production until reviewed
  return process.env.NODE_ENV !== "production";
}

export function isSocEnrichmentEnabled(): boolean {
  const flag = process.env.SOC_ENRICHMENT_ENABLED;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  // Default on in development & test, off in production until reviewed
  return process.env.NODE_ENV !== "production";
}

export function isSocQueryEnabled(): boolean {
  const flag = process.env.SOC_QUERY_ENABLED;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  // Default on in development & test, off in production until reviewed
  return process.env.NODE_ENV !== "production";
}

export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => ` - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`CRITICAL CONFIGURATION ERROR:\nInvalid environment configuration:\n${errorDetails}`);
  }

  // Validate production rules
  if (result.data.NODE_ENV === "production") {
    if (!result.data.NEXT_PUBLIC_SUPABASE_URL || !result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error(
        "CRITICAL PRODUCTION CONFIGURATION ERROR: Hosted Supabase configuration (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) is required in production."
      );
    }
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/** Resets cached env (for testing). */
export function resetServerEnvCache(): void {
  cachedEnv = null;
}

/**
 * Runs once when a server instance starts, before it handles requests. A misconfigured production
 * deployment refuses to start (typed config check + hosted-only storage), and server errors go to
 * the ErrorReporter (no-op unless ERROR_REPORTER_DSN is set; payloads are scrubbed).
 */
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertRuntimeConfig } = await import("./lib/config/runtime-config");
  assertRuntimeConfig();
  const { assertSafeStorageMode } = await import("./lib/supabase/config");
  assertSafeStorageMode();
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getErrorReporter } = await import("./lib/observability/error-reporter");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  await getErrorReporter().report({
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    requestId: (request.headers["x-request-id"] as string | undefined) ?? undefined,
  });
};

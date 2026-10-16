/**
 * Error reporting seam. Default: no-op (errors are still logged as redacted JSON). Optional
 * Sentry-compatible adapter when ERROR_REPORTER_DSN is set: sends only scrubbed fields (message,
 * stack, digest, route, request id). Never request bodies, cookies, users or learner content.
 * Never active in tests.
 */
import { log } from "./logger";
import { redactString } from "./redact";

export type ErrorEvent = {
  message: string;
  stack?: string;
  digest?: string;
  path?: string;
  method?: string;
  routeType?: string;
  requestId?: string;
};

export interface ErrorReporter {
  report(event: ErrorEvent): Promise<void>;
}

export const noopReporter: ErrorReporter = {
  async report(event) {
    log.error("server error", { digest: event.digest, path: event.path ? redactString(event.path, 200) : undefined, routeType: event.routeType, requestId: event.requestId });
  },
};

/** Scrubbed payload, exported for tests. */
export function scrubEvent(event: ErrorEvent) {
  return {
    message: redactString(event.message, 500),
    stack: event.stack ? redactString(event.stack, 4000) : undefined,
    digest: event.digest,
    path: event.path ? redactString(event.path.split("?")[0], 200) : undefined,
    method: event.method,
    routeType: event.routeType,
    requestId: event.requestId,
  };
}

/** Parses https://<publicKey>@<host>/<projectId>; null when malformed. */
export function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(projectId)) return null;
    return { endpoint: `https://${u.host}/api/${projectId}/store/`, publicKey: u.username };
  } catch {
    return null;
  }
}

export function sentryCompatibleReporter(dsn: string, fetchImpl: typeof fetch = fetch): ErrorReporter {
  const parsed = parseDsn(dsn);
  return {
    async report(event) {
      await noopReporter.report(event);
      if (!parsed) return;
      const e = scrubEvent(event);
      const body = {
        message: e.message,
        level: "error",
        platform: "node",
        tags: { digest: e.digest ?? "", routeType: e.routeType ?? "", requestId: e.requestId ?? "" },
        extra: { path: e.path, method: e.method, stack: e.stack },
      };
      try {
        await fetchImpl(parsed.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=cyberblade/1.0` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // Reporting must never break a request.
      }
    },
  };
}

export function getErrorReporter(env: Record<string, string | undefined> = process.env): ErrorReporter {
  if (env.VITEST || env.NODE_ENV === "test" || !env.ERROR_REPORTER_DSN) return noopReporter;
  return sentryCompatibleReporter(env.ERROR_REPORTER_DSN);
}

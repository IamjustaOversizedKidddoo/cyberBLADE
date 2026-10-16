/** Beta observability: logs and error reports never carry secrets, personal data or learner text. */
import { describe, expect, it, vi } from "vitest";
import { redact, redactString } from "@/lib/observability/redact";
import { formatLogLine } from "@/lib/observability/logger";
import { getErrorReporter, noopReporter, parseDsn, scrubEvent, sentryCompatibleReporter } from "@/lib/observability/error-reporter";

describe("redaction", () => {
  it.each([
    ["jwt", "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "[jwt]"],
    ["bearer", "Authorization: Bearer abcdefghijklmnop123", "Bearer [token]"],
    ["groq key", "gsk_abcdefghijklmnopqrstuvwxyz", "[key]"],
    ["google key", "AIzaSyA1234567890abcdefghijklmnop", "[key]"],
    ["email", "contact alice.smith@larkspur.example now", "[email]"],
    ["ipv4", "from 203.0.113.7 at", "[ip]"],
    ["ipv6", "from 2001:db8:0:0:0:0:2:1 at", "[ip]"],
    ["flag", "found CYBERBLADE{9f2c1a7e5b11}", "[flag]"],
    ["cookie", "sb-access-token=abcdefghijklmnopqrstuvwxyz0123", "[cookie]"],
  ])("removes %s", (_n, input, marker) => {
    const out = redactString(input);
    expect(out).toContain(marker);
  });

  it("drops secret and learner-text fields by name, keeps safe fields", () => {
    const out = redact({
      requestId: "r-1",
      route: "/labs/soc",
      cookie: "a=b",
      authorization: "Bearer x",
      message: "my Handler question with alice@x.example",
      reportData: { executiveSummary: "secret report" },
      rationale: "because 10.0.0.1",
      email: "a@b.example",
      nested: { serviceRoleKey: "s", count: 3 },
    }) as Record<string, unknown>;
    expect(out).toMatchObject({ requestId: "r-1", route: "/labs/soc", cookie: "[secret]", authorization: "[secret]", email: "[pii]", nested: { serviceRoleKey: "[secret]", count: 3 } });
    expect(JSON.stringify(out)).not.toMatch(/Handler question|secret report|10\.0\.0\.1|alice@/);
  });

  it("log lines are JSON with a request id and redacted fields", () => {
    const line = JSON.parse(formatLogLine("info", "lookup from 203.0.113.9", { requestId: "req-9", answer: "4625" }, new Date("2026-10-16T00:00:00Z")));
    expect(line).toEqual({ ts: "2026-10-16T00:00:00.000Z", level: "info", msg: "lookup from [ip]", requestId: "req-9", answer: "[text:4]" });
  });
});

describe("error reporter", () => {
  it("is a no-op in tests, even with a DSN", () => {
    expect(getErrorReporter({ VITEST: "true", ERROR_REPORTER_DSN: "https://k@o1.ingest.example/1" })).toBe(noopReporter);
    expect(getErrorReporter({ NODE_ENV: "production" })).toBe(noopReporter);
  });

  it("parses Sentry-style DSNs and rejects malformed ones", () => {
    expect(parseDsn("https://pub@o1.ingest.example/42")).toEqual({ endpoint: "https://o1.ingest.example/api/42/store/", publicKey: "pub" });
    expect(parseDsn("http://pub@o1.ingest.example/42")).toBeNull();
    expect(parseDsn("https://o1.ingest.example/42")).toBeNull();
  });

  it("sends only scrubbed fields (no query string, no learner content, no emails)", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const reporter = sentryCompatibleReporter("https://pub@o1.ingest.example/42", fetchImpl as unknown as typeof fetch);
    await reporter.report({ message: "boom for bob@larkspur.example", stack: "at x (203.0.113.1)", digest: "d1", path: "/learn/x?token=abc", requestId: "r1" });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(JSON.stringify(body)).not.toMatch(/bob@|203\.0\.113\.1|token=abc/);
    expect(body.tags).toMatchObject({ digest: "d1", requestId: "r1" });
    expect(scrubEvent({ message: "m", path: "/a?b=c" }).path).toBe("/a");
  });
});

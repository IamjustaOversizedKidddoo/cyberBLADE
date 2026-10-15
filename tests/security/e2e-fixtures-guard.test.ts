/** The test-only fixture endpoint (app/api/e2e) is closed unless explicitly enabled on loopback. */
import { describe, expect, it } from "vitest";
import { e2eFixturesAllowed } from "@/lib/e2e/fixtures-guard";

describe("e2e fixture endpoint guard", () => {
  it.each([
    [{}, "localhost:3100", false],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "false" }, "localhost:3100", false],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "1" }, "localhost:3100", false],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "true" }, "cyberblade.example:443", false],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "true" }, "localhost.evil.example", false],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "true" }, null, false],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "true" }, "localhost:3100", true],
    [{ CYBERBLADE_ALLOW_LOCAL_E2E: "true" }, "127.0.0.1:3100", true],
  ] as const)("env %j host %s -> %s", (env, host, want) => {
    expect(e2eFixturesAllowed(env, host)).toBe(want);
  });
});

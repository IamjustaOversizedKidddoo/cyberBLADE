import { describe, expect, it } from "vitest";
import { REAL_PROVIDER_FLAG, realProviderRefusal } from "@/lib/lab-engine/soc/ai-grading/calibration/real-provider-guard";

describe("real-provider guard", () => {
  const ok = { NODE_ENV: "development", GROQ_API_KEY: "k" } as NodeJS.ProcessEnv;
  it("refuses in CI, in tests, without the flag, and without keys", () => {
    expect(realProviderRefusal([REAL_PROVIDER_FLAG], { ...ok, CI: "1" })).toMatch(/CI/);
    expect(realProviderRefusal([REAL_PROVIDER_FLAG], { ...ok, VITEST: "true" })).toMatch(/test/);
    expect(realProviderRefusal([], ok)).toMatch(/pass --i-understand/);
    expect(realProviderRefusal([REAL_PROVIDER_FLAG], { NODE_ENV: "development" } as NodeJS.ProcessEnv)).toMatch(/no GROQ_API_KEY/);
  });
  it("allows only an explicit manual run with keys from the environment", () => {
    expect(realProviderRefusal([REAL_PROVIDER_FLAG], ok)).toBeNull();
  });
  it("this test process itself can never reach a real provider", () => {
    expect(realProviderRefusal([REAL_PROVIDER_FLAG], process.env)).not.toBeNull();
  });
});

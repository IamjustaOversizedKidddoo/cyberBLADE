/**
 * L1-A-06 regression: with SOC_WORKSPACE_ENABLED off, every browser-callable SOC workspace action
 * refuses (the pages were gated, the actions were not). Sweeps every export, so a new action
 * without the gate fails here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => ({ id: "u-flag", rank: 2 }) }));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));

import * as actions from "@/app/(app)/labs/soc/actions";
import * as aiActions from "@/app/(app)/labs/soc/ai-actions";
import * as queryActions from "@/app/(app)/labs/soc/query-actions";
import * as handlerActions from "@/app/(app)/labs/soc/handler-actions";

afterEach(() => {
  delete process.env.SOC_WORKSPACE_ENABLED;
  delete process.env.SOC_QUERY_ENABLED;
  delete process.env.SOC_HANDLER_ENABLED;
  delete process.env.SOC_ENRICHMENT_ENABLED;
});

const all = { ...actions, ...aiActions, ...queryActions, ...handlerActions } as Record<string, unknown>;
const exported = Object.entries(all).filter(([, v]) => typeof v === "function") as Array<[string, (...a: unknown[]) => Promise<unknown>]>;
const ID = "00000000-0000-4000-8000-000000000000";

describe("L1-A-06: the workspace flag gates the server actions", () => {
  it("finds the SOC actions", () => {
    expect(exported.length).toBeGreaterThanOrEqual(21);
  });

  it.each(exported.map(([name, fn]) => [name, fn] as const))("%s refuses when the workspace is off", async (_name, fn) => {
    process.env.SOC_WORKSPACE_ENABLED = "false";
    // Sub-feature flags on, so only the workspace flag can be the reason for the refusal.
    process.env.SOC_QUERY_ENABLED = "true";
    process.env.SOC_HANDLER_ENABLED = "true";
    process.env.SOC_ENRICHMENT_ENABLED = "true";
    await expect(fn(ID, { attemptId: ID, message: "hi", tool: "reputation", entityType: "ip", entityValue: "1.1.1.1" }, ID, ID)).rejects.toThrow("not enabled");
  });
});

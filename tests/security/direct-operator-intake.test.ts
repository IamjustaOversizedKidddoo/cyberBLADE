import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "127.0.0.1"]]),
  cookies: async () => ({
    get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined),
    set: (n: string, v: string) => cookieJar.set(n, v),
    delete: (n: string | { name: string }) => cookieJar.delete(typeof n === "string" ? n : n.name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { startOperator } from "@/app/start/actions";

describe("Direct Operator Intake Verification", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("allows multiple operators to register rapidly without velocity limit errors", async () => {
    const handles = [
      "phantom_01",
      "neon_rider",
      "operator_x",
      "alpha_ghost",
      "test_user_99",
      "speedy_login_1",
      "speedy_login_2",
      "speedy_login_3",
      "speedy_login_4",
      "speedy_login_5",
      "speedy_login_6",
      "speedy_login_7",
    ];

    for (const handle of handles) {
      const formData = new FormData();
      formData.set("handle", handle);
      formData.set("agree", "on");
      formData.set("next", "/dashboard");

      const state = { errors: {}, handle: "" };
      
      // Every operator should successfully redirect to /dashboard
      await expect(startOperator(state, formData)).rejects.toThrow("REDIRECT:/dashboard");
      // Cookie must be set with the created operator ID
      expect(cookieJar.has("neon_uid")).toBe(true);
    }
  });

  it("auto-generates an operator handle when input is blank or short", async () => {
    const formData = new FormData();
    formData.set("handle", "");
    formData.set("agree", "on");
    formData.set("next", "/dashboard");

    const state = { errors: {}, handle: "" };
    await expect(startOperator(state, formData)).rejects.toThrow("REDIRECT:/dashboard");
    expect(cookieJar.has("neon_uid")).toBe(true);
  });
});

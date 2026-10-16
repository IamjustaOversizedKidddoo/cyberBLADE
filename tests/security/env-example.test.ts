/** .env.example documents every runtime variable and never holds a real-looking secret. */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { RUNTIME_VARS } from "@/lib/config/runtime-config";

const text = fs.readFileSync(".env.example", "utf8");

describe(".env.example", () => {
  it("mentions every variable in the typed runtime config", () => {
    const missing = RUNTIME_VARS.map((v) => v.name).filter((n) => !new RegExp(`\\b${n}\\b`).test(text));
    expect(missing).toEqual([]);
  });

  it("contains no JWTs or real-looking keys", () => {
    expect(text).not.toMatch(/eyJ[\w-]{20,}|sk-[\w]{20,}|gsk_[\w]{20,}|AIza[\w-]{30,}/);
  });
});

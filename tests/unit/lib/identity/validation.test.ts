import { HANDLE_ERROR, handleSchema, parseStartForm } from "@/lib/identity/validation";

test("trims and lowercases the handle", () => {
  expect(handleSchema.parse("  Ghost_01 ")).toBe("ghost_01");
});

test.each(["<script>", "ab", "a".repeat(21), "has space", "dash-name", ""])("rejects %j", (input) => {
  const result = handleSchema.safeParse(input);
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(HANDLE_ERROR);
});

test("accepts 3 and 20 character handles", () => {
  expect(handleSchema.safeParse("abc").success).toBe(true);
  expect(handleSchema.safeParse("a".repeat(20)).success).toBe(true);
});

describe("parseStartForm", () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };

  test("valid form returns handle and safe next", () => {
    expect(parseStartForm(form({ handle: "Ghost_01", agree: "on", next: "/learn/core" }))).toEqual({
      ok: true,
      handle: "ghost_01",
      next: "/learn/core",
    });
  });

  test("missing agreement is an error", () => {
    expect(parseStartForm(form({ handle: "ghost_01" }))).toEqual({
      ok: false,
      errors: { agree: "You must accept the agreement to continue" },
    });
  });

  test("bad handle and missing agreement both reported", () => {
    expect(parseStartForm(form({ handle: "x" }))).toEqual({
      ok: false,
      errors: { handle: HANDLE_ERROR, agree: "You must accept the agreement to continue" },
    });
  });

  test("off-site next falls back to dashboard", () => {
    expect(parseStartForm(form({ handle: "ghost_01", agree: "on", next: "https://evil.example" }))).toMatchObject({
      next: "/dashboard",
    });
  });
});

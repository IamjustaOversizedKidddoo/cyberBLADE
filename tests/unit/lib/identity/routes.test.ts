import { resolveRoute, safeNextPath } from "@/lib/identity/routes";

test.each([
  ["https://evil.example", "/dashboard"],
  ["//evil.example", "/dashboard"],
  ["/\\evil", "/dashboard"],
  ["javascript:alert(1)", "/dashboard"],
  [null, "/dashboard"],
  [undefined, "/dashboard"],
  ["", "/dashboard"],
  ["/learn/core", "/learn/core"],
  ["/\t/evil.example", "/dashboard"],
  ["/\n/evil.example", "/dashboard"],
  ["/\r/evil.example", "/dashboard"],
  ["/\t\\evil", "/dashboard"],
  [" //evil.example", "/dashboard"],
  ["/learn/core?tab=lab#o1", "/learn/core?tab=lab#o1"],
])("safeNextPath(%s) → %s", (input, expected) => {
  expect(safeNextPath(input)).toBe(expected);
});

test("no cookie → start with next", () => {
  expect(resolveRoute({ pathname: "/dashboard", hasOperatorCookie: false })).toEqual({
    redirect: "/start?next=%2Fdashboard",
  });
});

test("no cookie → next keeps the query string (deep links)", () => {
  expect(resolveRoute({ pathname: "/labs/core-r0-terminal-lab-01", search: "?lesson=x", hasOperatorCookie: false })).toEqual({
    redirect: "/start?next=%2Flabs%2Fcore-r0-terminal-lab-01%3Flesson%3Dx",
  });
});

test("operator skips start", () => {
  expect(resolveRoute({ pathname: "/start", hasOperatorCookie: true })).toEqual({ redirect: "/dashboard" });
});

test.each(["/", "/start", "/credits", "/legal/ethical-use", "/verify/abc", "/session/stale"])(
  "public path %s passes without a cookie",
  (pathname) => {
    expect(resolveRoute({ pathname, hasOperatorCookie: false })).toBeNull();
  },
);

test("operator on an app page passes", () => {
  expect(resolveRoute({ pathname: "/dashboard", hasOperatorCookie: true })).toBeNull();
});

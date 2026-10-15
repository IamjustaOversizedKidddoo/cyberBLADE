/** L1-A-23 regression: CSV export cells cannot become spreadsheet formulas or break rows. */
import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/security/csv";

describe("csvCell", () => {
  it.each([
    ["=HYPERLINK(\"x\")", `"'=HYPERLINK(""x"")"`],
    ["+1", "'+1"],
    ["-2", "'-2"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\t=1", "'\t=1"],
    ["\r=1", `"'\r=1"`],
    ["a,b", `"a,b"`],
    ["line1\rline2", `"line1\rline2"`],
    ["line1\nline2", `"line1\nline2"`],
    ["plain", "plain"],
    [443, "443"],
  ] as const)("%j -> %j", (input, want) => {
    expect(csvCell(input)).toBe(want);
  });
});

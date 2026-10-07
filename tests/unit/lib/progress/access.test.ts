import { canAccessRank, lockedNotice } from "@/lib/progress/access";

test.each([
  [0, 0, true],
  [0, 1, false],
  [1, 0, true],
  [2, 2, true],
  [1, 2, false],
])("canAccessRank(operator %i, content %i) → %s", (operatorRank, contentRank, expected) => {
  expect(canAccessRank(operatorRank, contentRank)).toBe(expected);
});

test("locked notice names the challenge to pass", () => {
  expect(lockedNotice(1)).toBe("Locked — pass the Rank 0 challenge to open this.");
  expect(lockedNotice(2)).toBe("Locked — pass the Rank 1 challenge to open this.");
});

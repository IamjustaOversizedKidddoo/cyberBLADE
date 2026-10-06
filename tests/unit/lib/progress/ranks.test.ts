import { rankName, RANKS } from "@/lib/progress/ranks";

test("rank names", () => {
  expect(RANKS.map((r) => r.name)).toEqual(["Initiate", "Operator", "Watcher"]);
  expect(rankName(0)).toBe("Initiate");
  expect(rankName(1)).toBe("Operator");
});

test("unknown rank falls back to Initiate", () => {
  expect(rankName(9)).toBe("Initiate");
  expect(rankName(-1)).toBe("Initiate");
});

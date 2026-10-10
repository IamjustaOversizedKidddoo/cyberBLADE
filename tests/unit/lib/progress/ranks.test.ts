import { rankName, RANKS } from "@/lib/progress/ranks";

test("rank names", () => {
  expect(RANKS.map((r) => r.name)).toEqual(["Initiate", "Operator", "Watcher", "Hunter"]);
  expect(rankName(0)).toBe("Initiate");
  expect(rankName(1)).toBe("Operator");
  expect(rankName(2)).toBe("Watcher");
  expect(rankName(3)).toBe("Hunter");
});

test("unknown rank falls back to Initiate", () => {
  expect(rankName(9)).toBe("Initiate");
  expect(rankName(-1)).toBe("Initiate");
});

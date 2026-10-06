import { CORE, TRACKS } from "@/lib/catalog/tracks";

test("the four launch tracks are open", () => {
  expect(TRACKS.filter((t) => t.status === "open").map((t) => t.id)).toEqual(["purple", "soc", "pentest", "cloud"]);
});

test("catalogue lists every spec §3.1 track", () => {
  expect(TRACKS).toHaveLength(23);
});

test("track ids are unique", () => {
  expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
});

test("launch track titles match the roadmaps", () => {
  const title = (id: string) => TRACKS.find((t) => t.id === id)?.title;
  expect(title("purple")).toBe("Cybersecurity (Purple Team)");
  expect(title("pentest")).toBe("Penetration Tester / VAPT Analyst");
});

test("core has ranks 0–2", () => {
  expect(CORE.ranks.map((r) => r.rank)).toEqual([0, 1, 2]);
});

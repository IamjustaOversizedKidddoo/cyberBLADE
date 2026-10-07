import { continueTarget } from "@/lib/content/navigation";

const lessons = [
  { id: "a", title: "Alpha" },
  { id: "b", title: "Beta" },
  { id: "c", title: "Gamma" },
];

test("the next lesson in order", () => {
  expect(continueTarget(lessons, "a")).toEqual({ href: "/learn/b", label: "Continue to next lesson: Beta →" });
});

test("after the last lesson, back to the rank map", () => {
  expect(continueTarget(lessons, "c")).toEqual({ href: "/learn/core", label: "Back to the rank map →" });
});

test("unknown or missing lesson falls back to the rank map", () => {
  expect(continueTarget(lessons, "zzz")).toEqual({ href: "/learn/core", label: "Back to the rank map →" });
  expect(continueTarget(lessons, undefined)).toEqual({ href: "/learn/core", label: "Back to the rank map →" });
});

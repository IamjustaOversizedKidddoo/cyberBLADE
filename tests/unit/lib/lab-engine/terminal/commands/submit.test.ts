import { run } from "./helpers";

test("submit returns a request for the terminal UI to send to the server", () => {
  expect(run("submit 2 NEON{abc123}")).toEqual({ stdout: "", stderr: "", code: 0, submit: { objective: 2, answer: "NEON{abc123}" } });
});

test("multi-word answers are joined; quotes work too", () => {
  expect(run("submit 1 two words").submit).toEqual({ objective: 1, answer: "two words" });
  expect(run('submit 1 "two  spaces"').submit).toEqual({ objective: 1, answer: "two  spaces" });
});

test.each(["submit", "submit 1", "submit x answer", "submit 0 answer", "submit 1.5 answer"])("%s → usage error", (line) => {
  expect(run(line)).toEqual({ stdout: "", stderr: "submit: usage: submit <objective-number> <answer>\n", code: 2 });
});

test("submit is not usable in a pipe or redirect", () => {
  expect(run("echo x | submit 1 y")).toMatchObject({ stderr: "submit: use it on its own line, not in a pipe or redirect\n", code: 2 });
  expect(run("submit 1 y > out.txt").submit).toBeUndefined();
});

import { run } from "./helpers";

test("asks the terminal to clear", () => {
  expect(run("clear")).toEqual({ stdout: "", stderr: "", code: 0, clear: true });
});

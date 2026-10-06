import { run } from "./helpers";

test("prints the current user", () => {
  expect(run("whoami")).toEqual({ stdout: "op\n", stderr: "", code: 0 });
});

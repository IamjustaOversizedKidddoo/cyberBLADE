import { run } from "./helpers";

test("prints the machine name", () => {
  expect(run("hostname")).toEqual({ stdout: "neon-lab\n", stderr: "", code: 0 });
});

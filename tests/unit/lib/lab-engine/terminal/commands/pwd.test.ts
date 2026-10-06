import { shell } from "./helpers";

test("prints the working directory", () => {
  const sh = shell();
  expect(sh.exec("pwd")).toEqual({ stdout: "/home/op\n", stderr: "", code: 0 });
  sh.exec("cd /var/log");
  expect(sh.exec("pwd").stdout).toBe("/var/log\n");
});

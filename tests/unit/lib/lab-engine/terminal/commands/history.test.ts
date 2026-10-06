import { shell } from "./helpers";

test("numbers every non-empty line including itself", () => {
  const sh = shell();
  sh.exec("ls");
  sh.exec("   ");
  sh.exec("pwd");
  expect(sh.exec("history").stdout).toBe("    1  ls\n    2  pwd\n    3  history\n");
});

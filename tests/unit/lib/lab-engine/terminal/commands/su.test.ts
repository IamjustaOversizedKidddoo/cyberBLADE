import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";

test("su refuses with lab guidance message", () => {
  const s = createShell(fixtureWorld());
  expect(s.exec("su")).toEqual({
    stdout: "",
    stderr: "su: this lab can't ask for a password — use sudo for allowed commands\n",
    code: 1,
  });
  expect(s.exec("su -")).toEqual({
    stdout: "",
    stderr: "su: this lab can't ask for a password — use sudo for allowed commands\n",
    code: 1,
  });
  expect(s.exec("su root")).toEqual({
    stdout: "",
    stderr: "su: this lab can't ask for a password — use sudo for allowed commands\n",
    code: 1,
  });
});

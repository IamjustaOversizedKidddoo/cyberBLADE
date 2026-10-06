import { shell } from "./helpers";

test("creates an empty file", () => {
  const sh = shell();
  expect(sh.exec("touch new.txt").code).toBe(0);
  expect(sh.exec("cat new.txt").stdout).toBe("");
});

test.each([
  ["touch /etc/x", "touch: cannot touch '/etc/x': Permission denied\n"],
  ["touch no/such", "touch: cannot touch 'no/such': No such file or directory\n"],
  ["touch", "touch: missing file operand\n"],
])("%s → error", (line, stderr) => {
  expect(shell().exec(line)).toEqual({ stdout: "", stderr, code: 1 });
});

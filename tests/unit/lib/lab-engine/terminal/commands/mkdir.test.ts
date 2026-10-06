import { shell } from "./helpers";

test("creates directories, -p creates parents", () => {
  const sh = shell();
  expect(sh.exec("mkdir loot")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(sh.exec("mkdir -p a/b/c").code).toBe(0);
  expect(sh.exec("ls").stdout).toBe("a  Docs  loot  notes.txt\n");
});

test.each([
  ["mkdir Docs", "mkdir: cannot create directory 'Docs': File exists\n"],
  ["mkdir x/y", "mkdir: cannot create directory 'x/y': No such file or directory\n"],
  ["mkdir /etc/x", "mkdir: cannot create directory '/etc/x': Permission denied\n"],
  ["mkdir", "mkdir: missing operand\n"],
])("%s → error", (line, stderr) => {
  expect(shell().exec(line)).toEqual({ stdout: "", stderr, code: 1 });
});

import { shell } from "./helpers";

test("changes directory, relative and absolute", () => {
  const sh = shell();
  expect(sh.exec("cd Docs")).toMatchObject({ stdout: "", stderr: "", code: 0 });
  expect(sh.cwd()).toBe("/home/op/Docs");
  sh.exec("cd /var/log");
  expect(sh.cwd()).toBe("/var/log");
});

test("no argument goes home; ~ works", () => {
  const sh = shell();
  sh.exec("cd /tmp");
  sh.exec("cd");
  expect(sh.cwd()).toBe("/home/op");
  sh.exec("cd /tmp");
  sh.exec("cd ~");
  expect(sh.cwd()).toBe("/home/op");
});

test("cd - returns to the previous directory and prints it", () => {
  const sh = shell();
  sh.exec("cd /var/log");
  expect(sh.exec("cd -").stdout).toBe("/home/op\n");
  expect(sh.cwd()).toBe("/home/op");
});

test("going above / stays at /", () => {
  const sh = shell();
  sh.exec("cd ../../../../..");
  expect(sh.cwd()).toBe("/");
});

test.each([
  ["cd nope", "bash: cd: nope: No such file or directory\n"],
  ["cd notes.txt", "bash: cd: notes.txt: Not a directory\n"],
  ["cd /root", "bash: cd: /root: Permission denied\n"],
  ["cd a b", "bash: cd: too many arguments\n"],
])("%s → error", (line, stderr) => {
  const sh = shell();
  expect(sh.exec(line)).toEqual({ stdout: "", stderr, code: 1 });
  expect(sh.cwd()).toBe("/home/op");
});

test("prompt shows ~ for home", () => {
  const sh = shell();
  expect(sh.prompt()).toBe("op@neon-lab:~$ ");
  sh.exec("cd Docs");
  expect(sh.prompt()).toBe("op@neon-lab:~/Docs$ ");
  sh.exec("cd /var");
  expect(sh.prompt()).toBe("op@neon-lab:/var$ ");
});

import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "./fixture-world";

const sh = () => createShell(fixtureWorld());

test("prompt and starting directory", () => {
  const s = sh();
  expect(s.prompt()).toBe("op@neon-lab:~$ ");
  expect(s.cwd()).toBe("/home/op");
});

test("unknown command", () => {
  expect(sh().exec("frobnicate")).toEqual({ stdout: "", stderr: "frobnicate: command not found\n", code: 127 });
});

test("pipelines feed stdout to the next stdin", () => {
  expect(sh().exec("cat /var/log/auth.log | grep -c Failed").stdout).toBe("3\n");
  expect(sh().exec("cat /var/log/auth.log | grep Failed | grep -c root").stdout).toBe("2\n");
});

test("redirects write and append files", () => {
  const s = sh();
  expect(s.exec("echo hi > note.txt")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(s.exec("cat note.txt").stdout).toBe("hi\n");
  s.exec("echo again >> note.txt");
  expect(s.exec("cat note.txt").stdout).toBe("hi\nagain\n");
});

test("redirect errors", () => {
  expect(sh().exec("echo x > /etc/passwd")).toEqual({ stdout: "", stderr: "bash: /etc/passwd: Permission denied\n", code: 1 });
  expect(sh().exec("echo x > Docs")).toMatchObject({ stderr: "bash: Docs: Is a directory\n", code: 1 });
  expect(sh().exec("echo x > no/such/file")).toMatchObject({ stderr: "bash: no/such/file: No such file or directory\n" });
});

test("parse errors are reported bash-style and the shell keeps working", () => {
  const s = sh();
  expect(s.exec(`echo "oops`)).toEqual({ stdout: "", stderr: "bash: syntax error: unexpected end of file\n", code: 2 });
  expect(s.exec("pwd").stdout).toBe("/home/op\n");
});

test("blank lines do nothing", () => {
  expect(sh().exec("   ")).toEqual({ stdout: "", stderr: "", code: 0 });
});

test("exit code is the last command's", () => {
  expect(sh().exec("cat nope | echo ok")).toEqual({
    stdout: "ok\n",
    stderr: "cat: nope: No such file or directory\n",
    code: 0,
  });
});

test("environment variables", () => {
  const s = sh();
  expect(s.exec("echo $USER $HOME $HOSTNAME").stdout).toBe("op /home/op neon-lab\n");
  s.exec("cd /tmp");
  expect(s.exec("echo $PWD $OLDPWD").stdout).toBe("/tmp /home/op\n");
});

test("command output is never mutated into the world", () => {
  const world = fixtureWorld();
  const before = JSON.stringify(world);
  createShell(world).exec("echo x > /tmp/new");
  expect(JSON.stringify(world)).toBe(before);
});

test.each(["toString", "constructor", "__proto__", "hasOwnProperty"])("built-in object names are not commands: %s", (name) => {
  expect(sh().exec(name)).toEqual({ stdout: "", stderr: `${name}: command not found\n`, code: 127 });
});

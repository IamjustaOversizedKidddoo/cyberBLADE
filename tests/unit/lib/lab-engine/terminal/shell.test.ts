import { dir, file } from "@/lib/lab-engine/terminal/build";
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

describe("stderr redirects and /dev/null", () => {
  const devWorld = () => {
    const w = fixtureWorld();
    (w.root.children as Record<string, unknown>).dev = dir({ null: file("", { mode: 0o666 }) });
    return w;
  };
  test("2> sends errors to a file, not the screen", () => {
    const sh = createShell(devWorld());
    expect(sh.exec("cat nofile 2> err.txt")).toEqual({ stdout: "", stderr: "", code: 1 });
    expect(sh.exec("cat err.txt").stdout).toBe("cat: nofile: No such file or directory\n");
  });
  test("2>/dev/null throws errors away; output still shows", () => {
    const sh = createShell(devWorld());
    expect(sh.exec("cat nofile notes.txt 2>/dev/null")).toEqual({ stdout: "buy milk\ncheck logs\n", stderr: "", code: 1 });
    expect(sh.exec("cat /dev/null")).toEqual({ stdout: "", stderr: "", code: 0 });
    expect(sh.exec("echo gone > /dev/null")).toEqual({ stdout: "", stderr: "", code: 0 });
  });
  test("2>&1 puts errors into the pipe; order of redirects matters like bash", () => {
    const sh = createShell(devWorld());
    expect(sh.exec("cat nofile1 nofile2 2>&1 | wc -l").stdout).toBe("2\n");
    sh.exec("cat nofile notes.txt > both.txt 2>&1");
    expect(sh.exec("cat both.txt").stdout).toBe("cat: nofile: No such file or directory\nbuy milk\ncheck logs\n");
    expect(sh.exec("cat nofile 2>&1 > only-out.txt")).toMatchObject({ stderr: "cat: nofile: No such file or directory\n" });
    expect(sh.exec("cat only-out.txt").stdout).toBe("");
  });
  test("submit still refuses any redirect", () => {
    const sh = createShell(devWorld());
    expect(sh.exec("submit 1 x 2>/dev/null").stderr).toBe("");
    expect(sh.exec("submit 1 x 2>/dev/null").code).toBe(2);
  });
});

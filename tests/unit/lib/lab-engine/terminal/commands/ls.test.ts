import { run, shell } from "./helpers";

test("lists names sorted, ignoring case and leading dots, hidden only with -a", () => {
  expect(run("ls").stdout).toBe("Docs  notes.txt\n");
  expect(run("ls -a").stdout).toBe(".  ..  Docs  .hidden  notes.txt\n");
});

test("long format with permissions, owners, sizes and dates", () => {
  expect(run("ls -l").stdout).toBe(
    "total 2\n" + "drwxr-xr-x 1 op op 4096 Oct  6 09:14 Docs\n" + "-rw-r--r-- 1 op op   20 Oct  6 09:14 notes.txt\n",
  );
});

test("combined flags -la and -al", () => {
  expect(run("ls -la").stdout).toBe(run("ls -al").stdout);
  expect(run("ls -la").stdout).toContain(" .hidden\n");
});

test("long format pads owner columns", () => {
  const out = run("ls -l /").stdout;
  expect(out).toContain("drwx------ 1 root root 4096 Oct  6 09:14 root\n");
});

test("listing another directory and a file", () => {
  expect(run("ls /var/log").stdout).toBe("app.txt  auth.log  sys.log\n");
  expect(run("ls notes.txt").stdout).toBe("notes.txt\n");
});

test("several directories get headers", () => {
  expect(run("ls Docs /tmp").stdout).toBe("Docs:\nplan.md\n\n/tmp:\n");
});

test("globs expand before ls runs", () => {
  const sh = shell();
  sh.exec("cd /var/log");
  expect(sh.exec("ls *.log").stdout).toBe("auth.log  sys.log\n");
});

test.each([
  ["ls -z", "ls: invalid option -- 'z'\nTry 'ls --help' for more information.\n", 2],
  ["ls nope", "ls: cannot access 'nope': No such file or directory\n", 2],
  ["ls /root", "ls: cannot open directory '/root': Permission denied\n", 2],
  ["ls /srv/locked", "ls: cannot open directory '/srv/locked': Permission denied\n", 2],
])("%s → error", (line, stderr, code) => {
  expect(run(line)).toEqual({ stdout: "", stderr, code });
});

test("missing path reported but others still listed", () => {
  expect(run("ls nope Docs")).toEqual({
    stdout: "Docs:\nplan.md\n",
    stderr: "ls: cannot access 'nope': No such file or directory\n",
    code: 2,
  });
});

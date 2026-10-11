import { dir, file } from "@/lib/lab-engine/terminal/build";
import { createShell } from "@/lib/lab-engine/terminal/shell";
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

test("one name per line when output goes to a pipe or a file (like GNU ls)", () => {
  expect(run("ls | wc -l").stdout).toBe("2\n");
  expect(run("ls -a | grep hidden").stdout).toBe(".hidden\n");
  const sh = shell();
  sh.exec("ls > out.txt");
  // bash creates out.txt before ls runs, so it lists itself.
  expect(sh.exec("cat out.txt").stdout).toBe("Docs\nnotes.txt\nout.txt\n");
  expect(sh.exec("ls").stdout).toBe("Docs  notes.txt  out.txt\n");
});

test("ls -l shows special bits like GNU ls", () => {
  const sh = createShell({
    hostname: "h",
    user: "op",
    home: "/",
    root: dir({ bin: dir({ passwd: file("", { mode: 0o4755 }), crontab: file("", { group: "crontab", mode: 0o2755 }) }), tmp: dir({}, { mode: 0o1777 }) }),
  });
  expect(sh.exec("ls -l /bin").stdout).toBe(
    "total 2\n-rwxr-sr-x 1 root crontab 0 Oct  6 09:14 crontab\n-rwsr-xr-x 1 root root    0 Oct  6 09:14 passwd\n",
  );
  expect(sh.exec("ls -l /").stdout).toMatch(/^drwxrwxrwt 1 root root 4096 Oct  6 09:14 tmp$/m);
});

test("ls supports -1 (one per line on tty), -h (human sizes), and -R (recursive)", () => {
  const s = shell();
  expect(s.exec("ls -1").stdout).toBe("Docs\nnotes.txt\n");
  expect(s.exec("ls -lh").stdout).toContain("total 2");
  const rec = s.exec("ls -R").stdout;
  expect(rec).toContain("Docs:");
  expect(rec).toContain("notes.txt");
});


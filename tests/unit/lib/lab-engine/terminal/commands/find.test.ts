import { dir, file } from "@/lib/lab-engine/terminal/build";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import { GROUP, PASSWD } from "../fixture-identity";

const sh = () =>
  createShell({
    hostname: "h",
    user: "op",
    home: "/home/op",
    root: dir({
      dev: dir({ null: file("", { mode: 0o666 }) }),
      etc: dir({ passwd: file(PASSWD), group: file(GROUP), shadow: file("", { group: "shadow", mode: 0o640 }) }),
      home: dir({ op: dir({ "Notes.TXT": file("n\n", { owner: "op" }), docs: dir({ "a.txt": file("a\n", { owner: "op" }) }, { owner: "op" }) }, { owner: "op" }) }),
      root: dir({ "secret.txt": file("x") }, { mode: 0o700 }),
      usr: dir({
        bin: dir({
          passwd: file("", { mode: 0o4755 }),
          crontab: file("", { group: "crontab", mode: 0o2755 }),
          ls: file("", { mode: 0o755 }),
        }),
      }),
    }),
  });

test("searches the whole tree; unreadable folders are reported on stderr and the search goes on", () => {
  expect(sh().exec("find / -name passwd")).toEqual({
    stdout: "/etc/passwd\n/usr/bin/passwd\n",
    stderr: "find: '/root': Permission denied\n",
    code: 1,
  });
});

test("2>/dev/null hides only the noise", () => {
  expect(sh().exec("find / -name passwd 2>/dev/null")).toEqual({ stdout: "/etc/passwd\n/usr/bin/passwd\n", stderr: "", code: 1 });
});

test("-perm: all bits (-), any bit (/), exact, octal or symbolic", () => {
  const s = sh();
  expect(s.exec("find / -perm -4000 2>/dev/null").stdout).toBe("/usr/bin/passwd\n");
  expect(s.exec("find /usr -perm -u=s").stdout).toBe("/usr/bin/passwd\n");
  expect(s.exec("find /usr -perm /6000").stdout).toBe("/usr/bin/crontab\n/usr/bin/passwd\n");
  expect(s.exec("find /usr/bin -perm 755").stdout).toBe("/usr/bin\n/usr/bin/ls\n"); // the folder itself is 755 too
  expect(s.exec("find /dev -perm -o+w").stdout).toBe("/dev/null\n");
});

test("-type, -maxdepth, -iname, -user and -group", () => {
  const s = sh();
  expect(s.exec("find /home -maxdepth 2 -type d").stdout).toBe("/home\n/home/op\n/home/op/docs\n");
  expect(s.exec("find . -iname '*.txt'").stdout).toBe("./Notes.TXT\n./docs/a.txt\n");
  expect(s.exec("find /etc -user root -group shadow").stdout).toBe("/etc/shadow\n");
  expect(s.exec("find docs").stdout).toBe("docs\ndocs/a.txt\n");
});

test("missing paths, unknown tests and missing arguments", () => {
  const s = sh();
  expect(s.exec("find /nope")).toEqual({ stdout: "", stderr: "find: '/nope': No such file or directory\n", code: 1 });
  expect(s.exec("find / -exec ls")).toEqual({ stdout: "", stderr: "find: unknown predicate `-exec'\n", code: 1 });
  expect(s.exec("find / -name")).toEqual({ stdout: "", stderr: "find: missing argument to `-name'\n", code: 1 });
  expect(s.exec("find / -type z")).toEqual({ stdout: "", stderr: "find: Unknown argument to -type: z\n", code: 1 });
});

import { run, shell } from "./helpers";

const AUTH = "/var/log/auth.log";

test("prints matching lines; exit 0", () => {
  expect(run(`grep admin ${AUTH}`)).toEqual({
    stdout: "Oct  6 09:00:04 neon-lab sshd[103]: Failed password for admin from 10.0.0.7\n",
    stderr: "",
    code: 0,
  });
});

test("-c counts, -i ignores case, -v inverts, -n numbers", () => {
  expect(run(`grep -c Failed ${AUTH}`).stdout).toBe("3\n");
  expect(run(`grep -ic failed ${AUTH}`).stdout).toBe("3\n");
  expect(run(`grep -vc Failed ${AUTH}`).stdout).toBe("1\n");
  expect(run(`grep -n Accepted ${AUTH}`).stdout).toBe(
    "3:Oct  6 09:00:03 neon-lab sshd[102]: Accepted password for op from 10.0.0.9\n",
  );
});

test("basic regular expressions (default): ( | + are literal, \\( \\| \\+ are special", () => {
  expect(run(`grep -c "for (root|admin)" ${AUTH}`)).toMatchObject({ stdout: "0\n", code: 1 });
  expect(run(String.raw`grep -c "for \(root\|admin\)" ` + AUTH).stdout).toBe("3\n");
  expect(run(String.raw`grep -c "10\.0\.0\.5$" ` + AUTH).stdout).toBe("2\n");
  expect(run(String.raw`grep -c "sshd\[10[12]\]" ` + AUTH).stdout).toBe("3\n");
  expect(run(`grep -c "^Oct  6" ${AUTH}`).stdout).toBe("4\n");
});

test("-E extended regular expressions", () => {
  expect(run(`grep -cE "for (root|admin)" ${AUTH}`).stdout).toBe("3\n");
  expect(run(`grep -E -c "0+:0[0-9]" ${AUTH}`).stdout).toBe("4\n");
});

test("reads stdin and works in pipelines", () => {
  expect(run(`cat ${AUTH} | grep -c Failed`).stdout).toBe("3\n");
});

test("several files prefix the filename", () => {
  const sh = shell();
  sh.exec("cd /var/log");
  expect(sh.exec("grep ok sys.log app.txt").stdout).toBe("sys.log:boot ok\n");
});

test("no match exits 1 with no output", () => {
  expect(run(`grep nothing-here ${AUTH}`)).toEqual({ stdout: "", stderr: "", code: 1 });
});

test.each([
  [`grep -E "(" ${AUTH}`, "grep: Invalid regular expression\n"],
  ["grep", "Usage: grep [OPTION]... PATTERNS [FILE]...\n"],
  ["grep x nope", "grep: nope: No such file or directory\n"],
  ["grep x Docs", "grep: Docs: Is a directory\n"],
])("%s → error, exit 2", (line, stderr) => {
  expect(run(line)).toMatchObject({ stderr, code: 2 });
});

test("grep -r searches directories recursively", () => {
  const sh = shell();
  const res = sh.exec("grep -r secret /");
  expect(res.code).toBe(0);
  expect(res.stdout).toContain("secret");
});

test("grep -w matches whole words only, -l lists filenames, -q is quiet", () => {
  const sh = shell();
  sh.exec("cd /var/log");
  expect(sh.exec("grep -w ok sys.log").stdout).toBe("boot ok\n");
  expect(sh.exec("grep -w o sys.log").stdout).toBe("");
  expect(sh.exec("grep -l ok sys.log app.txt").stdout).toBe("sys.log\n");
  expect(sh.exec("grep -q ok sys.log")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(sh.exec("grep -q notfound sys.log")).toEqual({ stdout: "", stderr: "", code: 1 });
});


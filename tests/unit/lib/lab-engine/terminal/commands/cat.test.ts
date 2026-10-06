import { run } from "./helpers";

test("prints files in order", () => {
  expect(run("cat notes.txt /etc/hostname").stdout).toBe("buy milk\ncheck logs\nneon-lab\n");
});

test("reads stdin when no file is given", () => {
  expect(run("echo hi | cat").stdout).toBe("hi\n");
});

test.each([
  ["cat nope", "cat: nope: No such file or directory\n"],
  ["cat Docs", "cat: Docs: Is a directory\n"],
  ["cat /root/secret", "cat: /root/secret: Permission denied\n"],
])("%s → error", (line, stderr) => {
  expect(run(line)).toEqual({ stdout: "", stderr, code: 1 });
});

test("errors do not hide readable files", () => {
  expect(run("cat nope notes.txt")).toMatchObject({ stdout: "buy milk\ncheck logs\n", code: 1 });
});

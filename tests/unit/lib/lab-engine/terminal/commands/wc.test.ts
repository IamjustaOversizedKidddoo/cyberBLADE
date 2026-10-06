import { run } from "./helpers";

test("lines, words, bytes for a file", () => {
  expect(run("wc notes.txt").stdout).toBe(" 2  4 20 notes.txt\n");
  expect(run("wc -l notes.txt").stdout).toBe("2 notes.txt\n");
  expect(run("wc -w notes.txt").stdout).toBe("4 notes.txt\n");
  expect(run("wc -c notes.txt").stdout).toBe("20 notes.txt\n");
});

test("stdin: single count unpadded, several counts padded", () => {
  expect(run("cat notes.txt | wc -l").stdout).toBe("2\n");
  expect(run("cat notes.txt | wc").stdout).toBe("      2       4      20\n");
});

test("several files add a total", () => {
  expect(run("wc -l notes.txt /etc/hostname").stdout).toBe("2 notes.txt\n1 /etc/hostname\n3 total\n");
});

test("missing file", () => {
  expect(run("wc nope")).toEqual({ stdout: "", stderr: "wc: nope: No such file or directory\n", code: 1 });
});

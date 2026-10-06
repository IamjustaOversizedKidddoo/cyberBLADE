import { shell } from "./helpers";

const numbered = () => {
  const sh = shell();
  for (let i = 1; i <= 15; i++) sh.exec(`echo line${i} >> n.txt`);
  return sh;
};

test("first 10 lines by default", () => {
  expect(numbered().exec("head n.txt").stdout).toBe(Array.from({ length: 10 }, (_, i) => `line${i + 1}\n`).join(""));
});

test("-n N, -nN and -N", () => {
  const sh = numbered();
  expect(sh.exec("head -n 2 n.txt").stdout).toBe("line1\nline2\n");
  expect(sh.exec("head -n2 n.txt").stdout).toBe("line1\nline2\n");
  expect(sh.exec("head -3 n.txt").stdout).toBe("line1\nline2\nline3\n");
});

test("reads stdin", () => {
  expect(numbered().exec("cat n.txt | head -n 1").stdout).toBe("line1\n");
});

test("several files get headers", () => {
  expect(shell().exec("head -n 1 notes.txt /etc/hostname").stdout).toBe(
    "==> notes.txt <==\nbuy milk\n\n==> /etc/hostname <==\nneon-lab\n",
  );
});

test("missing file", () => {
  expect(shell().exec("head nope")).toEqual({
    stdout: "",
    stderr: "head: cannot open 'nope' for reading: No such file or directory\n",
    code: 1,
  });
});

test("bad count", () => {
  expect(shell().exec("head -n x notes.txt")).toMatchObject({ stderr: "head: invalid number of lines: 'x'\n", code: 1 });
});

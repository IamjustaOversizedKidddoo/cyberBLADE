import { shell } from "./helpers";

const numbered = () => {
  const sh = shell();
  for (let i = 1; i <= 15; i++) sh.exec(`echo line${i} >> n.txt`);
  return sh;
};

test("last 10 lines by default", () => {
  expect(numbered().exec("tail n.txt").stdout).toBe(Array.from({ length: 10 }, (_, i) => `line${i + 6}\n`).join(""));
});

test("-n 1 gives the last line", () => {
  expect(numbered().exec("tail -n 1 n.txt").stdout).toBe("line15\n");
  expect(numbered().exec("tail -2 n.txt").stdout).toBe("line14\nline15\n");
});

test("reads stdin", () => {
  expect(shell().exec("cat notes.txt | tail -n 1").stdout).toBe("check logs\n");
});

test("missing file", () => {
  expect(shell().exec("tail nope")).toEqual({
    stdout: "",
    stderr: "tail: cannot open 'nope' for reading: No such file or directory\n",
    code: 1,
  });
});

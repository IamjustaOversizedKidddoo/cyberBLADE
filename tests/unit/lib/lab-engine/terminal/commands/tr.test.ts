import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";

const run = (line: string) => createShell(fixtureWorld()).exec(line);

test("translates characters, ranges and escapes", () => {
  expect(run("echo hello | tr a-z A-Z").stdout).toBe("HELLO\n");
  expect(run("echo a-b-c | tr - ' '").stdout).toBe("a b c\n");
  expect(run("echo abc | tr abc x").stdout).toBe("xxx\n"); // SET2 padded with its last character
  expect(run("cat notes.txt | tr '\\n' ','").stdout).toBe("buy milk,check logs,");
});

test("-d deletes characters", () => {
  expect(run("cat notes.txt | tr -d '\\n'").stdout).toBe("buy milkcheck logs");
  expect(run("echo a1b2 | tr -d 0-9").stdout).toBe("ab\n");
});

test("NUL separators, as in /proc/<pid>/cmdline", () => {
  const s = createShell(fixtureWorld());
  expect(s.exec("echo x | tr x '\\0' | tr '\\0' y").stdout).toBe("y\n");
});

test("missing operands", () => {
  expect(run("tr")).toEqual({ stdout: "", stderr: "tr: missing operand\nTry 'tr --help' for more information.\n", code: 1 });
  expect(run("echo a | tr a")).toEqual({
    stdout: "",
    stderr: "tr: missing operand after 'a'\nTwo strings must be given when translating.\nTry 'tr --help' for more information.\n",
    code: 1,
  });
});

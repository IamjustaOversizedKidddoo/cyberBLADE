import { createShell } from "@/lib/lab-engine/terminal/shell";
import { permWorld } from "../fixture-perms";

test("umask prints, sets (octal or symbolic) and shapes new files", () => {
  const s = createShell(permWorld());
  expect(s.exec("umask").stdout).toBe("0022\n");
  expect(s.exec("umask -S").stdout).toBe("u=rwx,g=rx,o=rx\n");
  s.exec("umask 077");
  s.exec("touch new.txt");
  s.exec("mkdir newdir");
  expect(s.exec("ls -l").stdout).toMatch(/^-rw------- 1 op op +0 .* new\.txt$/m);
  expect(s.exec("ls -l").stdout).toMatch(/^drwx------ 1 op op .* newdir$/m);
  s.exec("umask u=rwx,g=rx,o=");
  expect(s.exec("umask").stdout).toBe("0027\n");
});

test("bad values, and no effect inside a pipeline (it runs in a subshell)", () => {
  const s = createShell(permWorld());
  expect(s.exec("umask 9")).toEqual({ stdout: "", stderr: "bash: umask: 9: octal number out of range\n", code: 1 });
  s.exec("umask 077 | cat");
  expect(s.exec("umask").stdout).toBe("0022\n");
});

import { createShell } from "@/lib/lab-engine/terminal/shell";
import { permWorld } from "../fixture-perms";

const sh = (user = "op") => createShell(permWorld(user));

test("the owner changes modes, octal or symbolic", () => {
  const s = sh();
  expect(s.exec("chmod 750 run.sh")).toEqual({ stdout: "", stderr: "", code: 0 });
  expect(s.exec("ls -l run.sh").stdout).toMatch(/^-rwxr-x--- /);
  s.exec("chmod u-x,o+r run.sh");
  expect(s.exec("ls -l run.sh").stdout).toMatch(/^-rw-r-xr-- /);
});

test("a locked file becomes readable after chmod u+r", () => {
  const s = sh();
  expect(s.exec("cat locked.txt").stderr).toBe("cat: locked.txt: Permission denied\n");
  s.exec("chmod u+r locked.txt");
  expect(s.exec("cat locked.txt").stdout).toBe("secret\n");
});

test("not the owner: Operation not permitted, mode unchanged, exit 1", () => {
  const s = sh();
  expect(s.exec("chmod 777 /etc/passwd")).toEqual({
    stdout: "",
    stderr: "chmod: changing permissions of '/etc/passwd': Operation not permitted\n",
    code: 1,
  });
  expect(s.exec("ls -l /etc/passwd").stdout).toMatch(/^-rw-r--r-- /);
});

test("missing files, bad modes and missing operands use GNU wording; other files are still changed", () => {
  const s = sh();
  expect(s.exec("chmod 600 nope.txt run.sh")).toEqual({
    stdout: "",
    stderr: "chmod: cannot access 'nope.txt': No such file or directory\n",
    code: 1,
  });
  expect(s.exec("ls -l run.sh").stdout).toMatch(/^-rw------- /);
  expect(s.exec("chmod u+q run.sh")).toEqual({
    stdout: "",
    stderr: "chmod: invalid mode: 'u+q'\nTry 'chmod --help' for more information.\n",
    code: 1,
  });
  expect(s.exec("chmod").stderr).toBe("chmod: missing operand\nTry 'chmod --help' for more information.\n");
  expect(s.exec("chmod 644").stderr).toBe("chmod: missing operand after '644'\nTry 'chmod --help' for more information.\n");
});

test("-R changes a whole tree", () => {
  const s = sh();
  s.exec("chmod -R go-rwx project");
  expect(s.exec("ls -l project/sub").stdout).toMatch(/^-rw------- 1 op op/m);
  expect(s.exec("ls -l project").stdout).toMatch(/^drwx------ 1 op op/m);
});

test("root may change anything", () => {
  const s = sh("root");
  expect(s.exec("chmod 0755 /usr/bin/tool").code).toBe(0);
  expect(s.exec("ls -l /usr/bin").stdout).toMatch(/^-rwxr-xr-x /m);
});

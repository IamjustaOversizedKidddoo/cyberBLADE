import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";

const sh = () => createShell(fixtureWorld());

test("env prints NAME=value lines in order", () => {
  expect(sh().exec("env").stdout).toBe("PATH=/usr/bin:/bin\nHOME=/home/op\nUSER=op\nHOSTNAME=neon-lab\nPWD=/home/op\n");
  expect(sh().exec("env FOO=1 ls")).toEqual({ stdout: "", stderr: "env: this lab only runs env with no arguments\n", code: 1 });
});

test("export sets and lists variables; unset removes them", () => {
  const s = sh();
  s.exec("export EDITOR=nano");
  expect(s.exec("echo $EDITOR").stdout).toBe("nano\n");
  expect(s.exec("env | grep EDITOR").stdout).toBe("EDITOR=nano\n");
  expect(s.exec("export").stdout).toBe(
    'declare -x EDITOR="nano"\ndeclare -x HOME="/home/op"\ndeclare -x HOSTNAME="neon-lab"\ndeclare -x PATH="/usr/bin:/bin"\ndeclare -x PWD="/home/op"\ndeclare -x USER="op"\n',
  );
  s.exec("unset EDITOR");
  expect(s.exec("echo $EDITOR").stdout).toBe("\n");
});

test("bad names, and no effect inside a pipeline", () => {
  const s = sh();
  expect(s.exec("export 1x=y")).toEqual({ stdout: "", stderr: "bash: export: `1x=y': not a valid identifier\n", code: 1 });
  s.exec("export X=1 | cat");
  expect(s.exec("echo $X").stdout).toBe("\n");
  s.exec("export Y=2");
  s.exec("unset Y | cat");
  expect(s.exec("echo $Y").stdout).toBe("2\n");
});

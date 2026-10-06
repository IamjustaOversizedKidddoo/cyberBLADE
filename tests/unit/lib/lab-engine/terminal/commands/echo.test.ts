import { run } from "./helpers";

test("joins arguments with spaces", () => {
  expect(run("echo hello   world").stdout).toBe("hello world\n");
  expect(run(`echo "two  spaces"`).stdout).toBe("two  spaces\n");
});

test("expands variables", () => {
  expect(run("echo $USER $HOME").stdout).toBe("op /home/op\n");
});

test("-n drops the newline; bare echo prints an empty line", () => {
  expect(run("echo -n hi").stdout).toBe("hi");
  expect(run("echo").stdout).toBe("\n");
});

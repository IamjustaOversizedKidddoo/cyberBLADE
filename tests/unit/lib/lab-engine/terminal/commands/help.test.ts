import { COMMANDS } from "@/lib/lab-engine/terminal/commands";
import { run } from "./helpers";

test("lists every command with its summary", () => {
  const out = run("help").stdout;
  for (const cmd of Object.values(COMMANDS)) {
    expect(out).toContain(cmd.name);
    expect(out).toContain(cmd.summary);
  }
});

test("the Rank 0 command set is complete", () => {
  expect(Object.keys(COMMANDS).sort()).toEqual(
    ["cat", "cd", "clear", "echo", "grep", "head", "help", "history", "hostname", "ls", "mkdir", "pwd", "submit", "tail", "touch", "wc", "whoami"].sort(),
  );
});

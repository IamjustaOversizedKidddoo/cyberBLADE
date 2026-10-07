import { COMMANDS } from "@/lib/lab-engine/terminal/commands";
import { run } from "./helpers";

test("lists every command with its summary", () => {
  const out = run("help").stdout;
  for (const cmd of Object.values(COMMANDS)) {
    expect(out).toContain(cmd.name);
    expect(out).toContain(cmd.summary);
  }
});

test("the lab command set is complete", () => {
  expect(Object.keys(COMMANDS).sort()).toEqual(
    ["cat", "cd", "clear", "curl", "dig", "echo", "grep", "head", "help", "history", "hostname", "ip", "ls", "mkdir", "ping", "pwd", "ss", "submit", "tail", "touch", "traceroute", "wc", "whoami"].sort(),
  );
});

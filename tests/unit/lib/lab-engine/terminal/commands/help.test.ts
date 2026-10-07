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
    ["cat", "cd", "chgrp", "chmod", "chown", "clear", "curl", "dig", "echo", "env", "export", "find", "grep", "groups", "head", "help", "history", "hostname", "id", "ip", "ls", "mkdir", "ping", "pwd", "ss", "submit", "tail", "touch", "tr", "traceroute", "umask", "uname", "unset", "wc", "whoami"].sort(),
  );
});

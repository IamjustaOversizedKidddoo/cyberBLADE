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
  expect(Object.keys(COMMANDS).sort()).toEqual([
    "base64",
      "cat",
      "cd",
      "chgrp",
      "chmod",
      "chown",
      "clear",
      "curl",
      "cut",
      "date",
      "dig",
      "echo",
      "env",
      "export",
      "file",
      "find",
      "Get-EventLog",
      "Get-Item",
      "Get-ItemProperty",
      "Get-Process",
      "Get-ScheduledTask",
      "Get-Service",
      "Get-WinEvent",
      "gi",
      "gp",
      "gps",
      "grep",
      "groups",
      "gsv",
      "head",
      "help",
      "history",
      "hostname",
      "id",
      "ip",
      "kill",
      "ls",
      "mkdir",
      "pgrep",
      "ping",
      "ps",
      "pwd",
      "Select-String",
      "sls",
      "sort",
      "ss",
      "stat",
      "strings",
      "su",
      "submit",
      "sudo",
      "systemctl",
      "tail",
      "touch",
      "tr",
      "traceroute",
      "umask",
      "uname",
      "uniq",
      "unset",
      "wc",
      "which",
      "whoami",
    ].sort(),
  );
});

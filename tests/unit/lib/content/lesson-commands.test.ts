import { consoleCommands, runConsoleCommands } from "@/lib/content/lesson-commands";
import { demoWorld } from "@/lib/lab-engine/terminal/demo-world";

const body = [
  "Intro",
  "```console",
  "$ pwd",
  "/home/learner",
  "$ ls -la",
  "```",
  "```bash",
  "$ not-a-console-block",
  "```",
  "```console",
  "$ nmap -sV 10.0.0.1",
  '$ echo "unterminated',
  "```",
].join("\n");

test("extracts $ lines from console blocks only", () => {
  expect(consoleCommands(body)).toEqual(["pwd", "ls -la", "nmap -sV 10.0.0.1", 'echo "unterminated']);
});

test("reports commands the lab shell cannot run, but not ordinary errors like missing files", () => {
  expect(runConsoleCommands(["pwd", "cat no-such-file", "nmap -sV 10.0.0.1", 'echo "x'], demoWorld())).toEqual([
    "$ nmap -sV 10.0.0.1 → nmap: command not found",
    '$ echo "x → bash: syntax error: unexpected end of file',
  ]);
});

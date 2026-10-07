import { consoleCommands, consoleExamples, outputMismatches, runConsoleCommands } from "@/lib/content/lesson-commands";
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

test("pairs each console command with the output the lesson shows under it", () => {
  expect(consoleExamples(body)).toEqual([
    { command: "pwd", shown: "/home/learner" },
    { command: "ls -la", shown: "" },
    { command: "nmap -sV 10.0.0.1", shown: "" },
    { command: 'echo "unterminated', shown: "" },
  ]);
});

test("reports examples whose shown output differs from what the lab shell prints", () => {
  const examples = consoleExamples(["```console", "$ whoami", "learner", "$ pwd", "/somewhere/else", "$ cd /tmp", "$ pwd", "/tmp", "```"].join("\n"));
  expect(outputMismatches(examples, demoWorld())).toEqual(["$ pwd → lesson shows \"/somewhere/else\", the lab shell prints \"/home/learner\""]);
});

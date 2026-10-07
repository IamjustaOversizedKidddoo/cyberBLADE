import { createLineEditor } from "@/components/labs/terminal/line-editor";

test("typing, backspace and enter submit the line", () => {
  const ed = createLineEditor();
  expect(ed.feed("l")).toEqual([{ type: "echo", text: "l" }]);
  ed.feed("s");
  expect(ed.feed("\x7f")).toEqual([{ type: "echo", text: "\b \b" }]);
  ed.feed("s");
  expect(ed.feed("\r")).toEqual([{ type: "echo", text: "\r\n" }, { type: "submit", line: "ls" }]);
  expect(ed.buffer()).toBe("");
});

test("pasted text with a newline submits in one chunk", () => {
  expect(createLineEditor().feed("pwd\r")).toEqual([
    { type: "echo", text: "pwd" },
    { type: "echo", text: "\r\n" },
    { type: "submit", line: "pwd" },
  ]);
});

test("backspace on an empty line does nothing", () => {
  expect(createLineEditor().feed("\x7f")).toEqual([]);
});

test("Ctrl+C abandons the line", () => {
  const ed = createLineEditor();
  ed.feed("rm stuff");
  expect(ed.feed("\x03")).toEqual([{ type: "echo", text: "^C\r\n" }, { type: "interrupt" }]);
  expect(ed.buffer()).toBe("");
});

test("Ctrl+L clears the screen", () => {
  expect(createLineEditor().feed("\x0c")).toEqual([{ type: "clear" }]);
});

test("arrow keys ask for history; other escape sequences are ignored", () => {
  const ed = createLineEditor();
  expect(ed.feed("\x1b[A")).toEqual([{ type: "history", direction: "prev" }]);
  expect(ed.feed("\x1b[B")).toEqual([{ type: "history", direction: "next" }]);
  expect(ed.feed("\x1b[C\x1b[D")).toEqual([]);
});

test("replace swaps the current line (for history recall)", () => {
  const ed = createLineEditor();
  ed.feed("abc");
  expect(ed.replace("ls -la")).toBe("\b \b\b \b\b \bls -la");
  expect(ed.buffer()).toBe("ls -la");
});

test("tab is ignored, other control characters are dropped", () => {
  expect(createLineEditor().feed("\t\x01")).toEqual([]);
});

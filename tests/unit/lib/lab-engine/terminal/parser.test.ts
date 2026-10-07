import { expandGlobs, parseLine } from "@/lib/lab-engine/terminal/parser";
import { Vfs } from "@/lib/lab-engine/terminal/vfs";
import { fixtureWorld } from "./fixture-world";

describe("parseLine", () => {
  test("quotes, variables, pipes and redirects", () => {
    expect(parseLine(`echo "a b" 'c $HOME' $HOME | grep a > out.txt`, { HOME: "/h" })).toEqual({
      commands: [{ argv: ["echo", "a b", "c $HOME", "/h"] }, { argv: ["grep", "a"], redirects: [{ fd: 1, op: ">", path: "out.txt" }] }],
    });
  });

  test("append redirect and ${VAR}", () => {
    expect(parseLine("echo ${USER}x >> log", { USER: "op" })).toEqual({
      commands: [{ argv: ["echo", "opx"], redirects: [{ fd: 1, op: ">>", path: "log" }] }],
    });
  });

  test("unknown variables expand to nothing; lone $ stays", () => {
    expect(parseLine("echo $NOPE end $", {})).toEqual({ commands: [{ argv: ["echo", "end", "$"] }] });
  });

  test("backslash escapes outside quotes and selectively inside double quotes", () => {
    expect(parseLine(String.raw`echo a\ b "x\"y" "\$HOME" 'q\n'`, { HOME: "/h" })).toEqual({
      commands: [{ argv: ["echo", "a b", 'x"y', "$HOME", String.raw`q\n`] }],
    });
  });

  test("tilde expands only when unquoted and leading", () => {
    expect(parseLine("cat ~/notes.txt '~/x' a~b ~", { HOME: "/home/op" })).toEqual({
      commands: [{ argv: ["cat", "/home/op/notes.txt", "~/x", "a~b", "/home/op"] }],
    });
  });

  test("quoted wildcards are marked literal", () => {
    expect(parseLine(`ls *.log "*.txt"`, {})).toEqual({ commands: [{ argv: ["ls", "*.log", "*.txt"], literal: [2] }] });
  });

  test("blank line is an empty pipeline", () => {
    expect(parseLine("   ", {})).toEqual({ commands: [] });
  });

  test("operators glued to words", () => {
    expect(parseLine("cat a|grep b>c", {})).toEqual({
      commands: [{ argv: ["cat", "a"] }, { argv: ["grep", "b"], redirects: [{ fd: 1, op: ">", path: "c" }] }],
    });
  });

  test.each([
    [`echo "oops`, "syntax error: unexpected end of file"],
    [`echo 'oops`, "syntax error: unexpected end of file"],
    ["| grep x", "syntax error near unexpected token `|'"],
    ["ls |", "syntax error near unexpected token `|'"],
    ["echo hi >", "syntax error near unexpected token `newline'"],
    ["cd x && ls", "syntax error: ';' and '&&' are not supported in this lab shell"],
    ["cd x; ls", "syntax error: ';' and '&&' are not supported in this lab shell"],
  ])("%s → error", (line, error) => {
    expect(parseLine(line, {})).toEqual({ error });
  });
});

describe("expandGlobs", () => {
  const vfs = () => new Vfs(fixtureWorld().root);

  test("expands * in the last segment, sorted", () => {
    expect(expandGlobs(["cat", "*.log"], "/var/log", vfs(), "/home/op")).toEqual(["cat", "auth.log", "sys.log"]);
  });

  test("keeps the literal when nothing matches", () => {
    expect(expandGlobs(["cat", "*.zip"], "/var/log", vfs(), "/home/op")).toEqual(["cat", "*.zip"]);
  });

  test("keeps directory prefixes and supports ?", () => {
    expect(expandGlobs(["ls", "/var/log/???.log"], "/", vfs(), "/home/op")).toEqual(["ls", "/var/log/sys.log"]);
    expect(expandGlobs(["ls", "log/a*"], "/var", vfs(), "/home/op")).toEqual(["ls", "log/app.txt", "log/auth.log"]);
  });

  test("* does not match hidden files", () => {
    expect(expandGlobs(["ls", "*"], "/home/op", vfs(), "/home/op")).toEqual(["ls", "Docs", "notes.txt"]);
    expect(expandGlobs(["ls", ".h*"], "/home/op", vfs(), "/home/op")).toEqual(["ls", ".hidden"]);
  });

  test("never expands the command name or literal args", () => {
    expect(expandGlobs(["*.log", "*.log"], "/var/log", vfs(), "/home/op", { literal: [1] })).toEqual(["*.log", "*.log"]);
  });

  test("unreadable directories match nothing", () => {
    expect(expandGlobs(["ls", "/srv/locked/*"], "/", vfs(), "/home/op", { user: "op" })).toEqual(["ls", "/srv/locked/*"]);
  });
});

describe("stderr redirects", () => {
  const p = (line: string) => parseLine(line, {});
  test("2>, 2>> and 2>&1 are kept in order, after any argument", () => {
    expect(p("cat a 2> err")).toEqual({ commands: [{ argv: ["cat", "a"], redirects: [{ fd: 2, op: ">", path: "err" }] }] });
    expect(p("cat a 2>>err > out")).toEqual({
      commands: [{ argv: ["cat", "a"], redirects: [{ fd: 2, op: ">>", path: "err" }, { fd: 1, op: ">", path: "out" }] }],
    });
    expect(p("ls x > f 2>&1")).toEqual({ commands: [{ argv: ["ls", "x"], redirects: [{ fd: 1, op: ">", path: "f" }, { fd: 2, toStdout: true }] }] });
    expect(p("ls x 2>&1 | wc -l")).toEqual({ commands: [{ argv: ["ls", "x"], redirects: [{ fd: 2, toStdout: true }] }, { argv: ["wc", "-l"] }] });
  });
  test("a 2 inside a word is just text", () => {
    expect(p("echo a2>f")).toEqual({ commands: [{ argv: ["echo", "a2"], redirects: [{ fd: 1, op: ">", path: "f" }] }] });
    expect(p("echo 2")).toEqual({ commands: [{ argv: ["echo", "2"] }] });
  });
  test("a redirect without a target", () => {
    expect(p("ls 2>")).toEqual({ error: "syntax error near unexpected token `newline'" });
  });
});

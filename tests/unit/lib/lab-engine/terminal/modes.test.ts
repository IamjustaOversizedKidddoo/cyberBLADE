import { parseMode } from "@/lib/lab-engine/terminal/modes";

const f = (spec: string, current: number, umask = 0o022) => parseMode(spec, current, { isDir: false, umask });
const d = (spec: string, current: number, umask = 0o022) => parseMode(spec, current, { isDir: true, umask });

test.each([
  ["4755", 0o644, 0o4755],
  ["644", 0o777, 0o644],
  ["0644", 0o4755, 0o644], // numeric mode on a file sets exactly, clearing setuid
  ["u+s,g-w", 0o775, 0o4755],
  ["u=rw,g=r,o=", 0o777, 0o640],
  ["go-rwx", 0o755, 0o700],
  ["a=", 0o755, 0o0],
  ["u+x", 0o644, 0o744],
  ["a+X", 0o644, 0o644], // X: only if already executable by someone (or a directory)
  ["a+X", 0o744, 0o755],
  ["g+s", 0o755, 0o2755],
  ["u-s", 0o4755, 0o755],
  ["o+t", 0o644, 0o1644],
  ["u+", 0o644, 0o644], // valid in GNU: adds nothing
])("file: chmod %s on %o", (spec, current, want) => {
  expect(f(spec, current)).toBe(want);
});

test("no who-letters means all, except bits set in the umask", () => {
  expect(f("+x", 0o644, 0o077)).toBe(0o744);
  expect(f("+x", 0o644, 0o022)).toBe(0o755);
  expect(f("-x", 0o755, 0o022)).toBe(0o644);
});

test("directories: numeric modes keep setuid/setgid, X always applies, +t sets sticky", () => {
  expect(d("755", 0o2755)).toBe(0o2755);
  expect(d("a+X", 0o644)).toBe(0o755);
  expect(d("+t", 0o777)).toBe(0o1777);
});

test.each(["9", "8755", "u+q", "abc", "77777", "", "x+r", "u"])("invalid mode %j is null", (spec) => {
  expect(f(spec, 0o644)).toBeNull();
});

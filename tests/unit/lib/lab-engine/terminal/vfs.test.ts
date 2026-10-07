import { dir, file } from "@/lib/lab-engine/terminal/build";
import type { Node } from "@/lib/lab-engine/terminal/types";
import { formatMode, resolvePath, Vfs } from "@/lib/lab-engine/terminal/vfs";
import { fixtureWorld } from "./fixture-world";

const vfs = () => new Vfs(fixtureWorld().root);
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return "no error";
};

describe("resolvePath", () => {
  test.each([
    ["/home/op", "../../../..", "/"],
    ["/tmp", "~/notes", "/home/op/notes"],
    ["/tmp", "~", "/home/op"],
    ["/home/op", "Docs/./plan.md", "/home/op/Docs/plan.md"],
    ["/home/op", "/var//log/", "/var/log"],
    ["/var/log", "..", "/var"],
    ["/", ".", "/"],
    ["/home/op", "~user", "/home/op/~user"],
  ])("resolvePath(%s, %s) → %s", (cwd, p, expected) => {
    expect(resolvePath(cwd, p, "/home/op")).toBe(expected);
  });
});

describe("formatMode", () => {
  test("directory and file modes", () => {
    expect(formatMode({ kind: "dir", mode: 0o750 } as Node)).toBe("drwxr-x---");
    expect(formatMode({ kind: "file", mode: 0o644 } as Node)).toBe("-rw-r--r--");
    expect(formatMode({ kind: "file", mode: 0o600 } as Node)).toBe("-rw-------");
    expect(formatMode({ kind: "dir", mode: 0o711 } as Node)).toBe("drwx--x--x");
  });
});

describe("Vfs reads and permissions", () => {
  test("reads a readable file", () => {
    expect(vfs().readFile("/home/op/notes.txt", "op")).toBe("buy milk\ncheck logs\n");
  });

  test("permission denied on another user's private file", () => {
    expect(code(() => vfs().readFile("/root/secret", "op"))).toBe("EACCES");
  });

  test("root bypasses permissions", () => {
    expect(vfs().readFile("/root/secret", "root")).toBe("root only\n");
  });

  test("missing file, directory, and file-as-directory errors", () => {
    expect(code(() => vfs().readFile("/nope", "op"))).toBe("ENOENT");
    expect(code(() => vfs().readFile("/home/op", "op"))).toBe("EISDIR");
    expect(code(() => vfs().readFile("/home/op/notes.txt/x", "op"))).toBe("ENOTDIR");
  });

  test("execute-only directory can be traversed but not listed", () => {
    expect(vfs().readFile("/srv/locked/known.txt", "op")).toBe("you found me\n");
    expect(code(() => vfs().list("/srv/locked", "op"))).toBe("EACCES");
  });

  test("lists a readable directory", () => {
    expect(
      vfs()
        .list("/home/op", "op")
        .map(([name]) => name)
        .sort(),
    ).toEqual([".hidden", "Docs", "notes.txt"]);
  });

  test("checkDir allows cd only into searchable directories", () => {
    const v = vfs();
    expect(() => v.checkDir("/home/op/Docs", "op")).not.toThrow();
    expect(code(() => v.checkDir("/root", "op"))).toBe("EACCES");
    expect(code(() => v.checkDir("/home/op/notes.txt", "op"))).toBe("ENOTDIR");
    expect(code(() => v.checkDir("/missing", "op"))).toBe("ENOENT");
  });

  test("stat returns nodes without permission checks and null when missing", () => {
    expect(vfs().stat("/root/secret")?.kind).toBe("file");
    expect(vfs().stat("/missing")).toBeNull();
  });
});

describe("Vfs writes", () => {
  test("creates, overwrites and appends files the user may write", () => {
    const v = vfs();
    v.write("/home/op/out.txt", "a\n", "op", false);
    v.write("/home/op/out.txt", "b\n", "op", true);
    expect(v.readFile("/home/op/out.txt", "op")).toBe("a\nb\n");
    expect(v.stat("/home/op/out.txt")).toMatchObject({ owner: "op", mode: 0o644 });
    v.write("/home/op/out.txt", "c\n", "op", false);
    expect(v.readFile("/home/op/out.txt", "op")).toBe("c\n");
  });

  test("cannot write into a directory owned by someone else", () => {
    expect(code(() => vfs().write("/etc/new", "x", "op", false))).toBe("EACCES");
  });

  test("cannot overwrite a directory", () => {
    expect(code(() => vfs().write("/home/op/Docs", "x", "op", false))).toBe("EISDIR");
  });

  test("mkdir, mkdir -p and EEXIST", () => {
    const v = vfs();
    v.mkdir("/home/op/loot", "op", false);
    expect(v.stat("/home/op/loot")?.kind).toBe("dir");
    expect(code(() => v.mkdir("/home/op/loot", "op", false))).toBe("EEXIST");
    expect(() => v.mkdir("/home/op/loot", "op", true)).not.toThrow();
    expect(code(() => v.mkdir("/home/op/a/b", "op", false))).toBe("ENOENT");
    v.mkdir("/home/op/a/b/c", "op", true);
    expect(v.stat("/home/op/a/b/c")?.kind).toBe("dir");
  });

  test("touch creates an empty file", () => {
    const v = vfs();
    v.touch("/tmp/empty", "op");
    expect(v.readFile("/tmp/empty", "op")).toBe("");
  });

  test("the world passed in is never mutated", () => {
    const world = fixtureWorld();
    const before = JSON.stringify(world.root);
    new Vfs(world.root).write("/home/op/x", "y", "op", false);
    expect(JSON.stringify(world.root)).toBe(before);
  });
});

test("build helpers set sane defaults", () => {
  expect(file("x")).toMatchObject({ kind: "file", content: "x", owner: "root", group: "root", mode: 0o644 });
  expect(dir({})).toMatchObject({ kind: "dir", children: {}, owner: "root", mode: 0o755 });
});

describe("groups, special bits and umask", () => {
  const etc = () =>
    dir({
      passwd: file("root:x:0:0:root:/root:/bin/bash\nop:x:1000:1000::/home/op:/bin/bash\nbob:x:1001:1001::/home/bob:/bin/bash\n"),
      group: file("root:x:0:\nadm:x:4:op\nop:x:1000:\nbob:x:1001:\n"),
    });

  test("group members get the group bits; others get the other bits", () => {
    const vfs = new Vfs(dir({ etc: etc(), log: file("secret\n", { group: "adm", mode: 0o640 }) }));
    expect(vfs.readFile("/log", "op")).toBe("secret\n");
    expect(() => vfs.readFile("/log", "bob")).toThrow(/EACCES/);
  });

  test("only the first matching class counts: a group member gets group bits even if other has more", () => {
    const vfs = new Vfs(dir({ etc: etc(), f: file("x\n", { owner: "bob", group: "adm", mode: 0o604 }) }));
    expect(() => vfs.readFile("/f", "op")).toThrow(/EACCES/);
    expect(vfs.readFile("/f", "root")).toBe("x\n");
  });

  test("umask shapes new files and directories", () => {
    const vfs = new Vfs(dir({ etc: etc(), home: dir({}, { owner: "op", mode: 0o755 }) }), { umask: 0o077 });
    vfs.write("/home/a.txt", "", "op", false);
    vfs.mkdir("/home/d", "op", false);
    expect(vfs.stat("/home/a.txt")!.mode).toBe(0o600);
    expect(vfs.stat("/home/d")!.mode).toBe(0o700);
    vfs.umask = 0o022;
    vfs.touch("/home/b.txt", "op");
    expect(vfs.stat("/home/b.txt")!.mode).toBe(0o644);
  });

  test("setMode and setOwner change the node", () => {
    const vfs = new Vfs(dir({ f: file("x") }));
    vfs.setMode("/f", 0o4755);
    vfs.setOwner("/f", "op", "adm");
    expect(vfs.stat("/f")).toMatchObject({ mode: 0o4755, owner: "op", group: "adm" });
  });

  test("formatMode shows setuid, setgid and sticky bits", () => {
    expect(formatMode({ kind: "file", mode: 0o4755 })).toBe("-rwsr-xr-x");
    expect(formatMode({ kind: "file", mode: 0o4644 })).toBe("-rwSr--r--");
    expect(formatMode({ kind: "file", mode: 0o2755 })).toBe("-rwxr-sr-x");
    expect(formatMode({ kind: "file", mode: 0o2745 })).toBe("-rwxr-Sr-x");
    expect(formatMode({ kind: "dir", mode: 0o1777 })).toBe("drwxrwxrwt");
    expect(formatMode({ kind: "dir", mode: 0o1776 })).toBe("drwxrwxrwT");
  });
});

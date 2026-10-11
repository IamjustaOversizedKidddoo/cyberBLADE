import { createShell } from "@/lib/lab-engine/terminal/shell";
import { dir, file } from "@/lib/lab-engine/terminal/build";

function makeShell() {
  return createShell({
    hostname: "cybersim",
    user: "op",
    home: "/home/op",
    root: dir({
      home: dir({
        op: dir({
          "sample.txt": file("cherry\napple\nbanana\napple\n"),
          "passwd.txt": file("root:x:0:0:root:/root:/bin/bash\nop:x:1000:1000:op:/home/op:/bin/bash\n"),
          "encoded.txt": file("Q3liZXJCTEFERXtoZWxsb193b3JsZH0=\n"),
          "script.sh": file("#!/bin/bash\necho hello\n", { mode: 0o755 }),
        }),
      }),
    }),
  });
}

describe("new terminal utilities", () => {
  it("which resolves known command paths and fails for unknown commands", () => {
    const sh = makeShell();
    expect(sh.exec("which ls").stdout).toBe("/usr/bin/ls\n");
    expect(sh.exec("which grep cut").stdout).toBe("/usr/bin/grep\n/usr/bin/cut\n");
    expect(sh.exec("which unknowncmd").code).toBe(1);
    expect(sh.exec("which unknowncmd").stderr).toBe("unknowncmd: not found\n");
  });

  it("sort sorts alphabetically, in reverse (-r), and unique (-u)", () => {
    const sh = makeShell();
    expect(sh.exec("sort sample.txt").stdout).toBe("apple\napple\nbanana\ncherry\n");
    expect(sh.exec("sort -r sample.txt").stdout).toBe("cherry\nbanana\napple\napple\n");
    expect(sh.exec("sort -u sample.txt").stdout).toBe("apple\nbanana\ncherry\n");
  });

  it("uniq removes duplicates, supports -c and -d", () => {
    const sh = makeShell();
    expect(sh.exec("sort sample.txt | uniq").stdout).toBe("apple\nbanana\ncherry\n");
    expect(sh.exec("sort sample.txt | uniq -d").stdout).toBe("apple\n");
    expect(sh.exec("sort sample.txt | uniq -c").stdout).toBe("      2 apple\n      1 banana\n      1 cherry\n");
  });

  it("cut extracts delimited fields", () => {
    const sh = makeShell();
    expect(sh.exec("cut -d: -f1 passwd.txt").stdout).toBe("root\nop\n");
    expect(sh.exec("cut -d: -f1,7 passwd.txt").stdout).toBe("root:/bin/bash\nop:/bin/bash\n");
  });

  it("base64 encodes and decodes strings and files", () => {
    const sh = makeShell();
    expect(sh.exec("echo -n 'hello' | base64").stdout).toBe("aGVsbG8=\n");
    expect(sh.exec("base64 -d encoded.txt").stdout).toBe("CyberBLADE{hello_world}");
  });

  it("file identifies scripts, text, and directories", () => {
    const sh = makeShell();
    expect(sh.exec("file sample.txt").stdout).toBe("sample.txt: ASCII text\n");
    expect(sh.exec("file script.sh").stdout).toBe("script.sh: POSIX shell script, ASCII text executable\n");
    expect(sh.exec("file /home").stdout).toBe("/home: directory\n");
  });

  it("strings extracts printable ASCII sequences", () => {
    const sh = makeShell();
    expect(sh.exec("strings script.sh").stdout).toBe("#!/bin/bash\necho hello\n");
  });

  it("stat displays file metadata", () => {
    const sh = makeShell();
    const out = sh.exec("stat sample.txt").stdout;
    expect(out).toContain("File: sample.txt");
    expect(out).toContain("Size:");
  });

  it("date prints simulated system timestamp", () => {
    const sh = makeShell();
    expect(sh.exec("date").stdout).toMatch(/^Sun Oct 11/);
  });
});

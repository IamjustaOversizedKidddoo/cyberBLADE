import { run } from "./helpers";

test("uname and its flags", () => {
  expect(run("uname").stdout).toBe("Linux\n");
  expect(run("uname -a").stdout).toBe(
    "Linux neon-lab 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux\n",
  );
  expect(run("uname -r").stdout).toBe("6.8.0-45-generic\n");
  expect(run("uname -sr").stdout).toBe("Linux 6.8.0-45-generic\n");
  expect(run("uname -n -m").stdout).toBe("neon-lab x86_64\n");
  expect(run("uname -q")).toEqual({ stdout: "", stderr: "uname: invalid option -- 'q'\nTry 'uname --help' for more information.\n", code: 1 });
});

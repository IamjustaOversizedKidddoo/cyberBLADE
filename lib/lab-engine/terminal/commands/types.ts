import type { Vfs } from "../vfs";

export type CmdResult = {
  stdout: string;
  stderr: string;
  code: number;
  clear?: boolean;
  /** Set by `submit`: the terminal UI sends this answer to the server for checking. */
  submit?: { objective: number; answer: string };
};

export type CmdContext = {
  argv: string[];
  stdin: string;
  vfs: Vfs;
  cwd: string;
  user: string;
  home: string;
  hostname: string;
  env: Record<string, string>;
  history: string[];
  /** True when stdout goes to the screen; false into a pipe or a file (GNU ls changes format). */
  isTty: boolean;
  /** True when this is the only command on the line, with no redirect. */
  alone: boolean;
  setCwd(path: string): void;
};

export type Command = { name: string; summary: string; run(ctx: CmdContext): CmdResult };

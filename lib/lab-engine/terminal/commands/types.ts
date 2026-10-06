import type { Vfs } from "../vfs";

export type CmdResult = { stdout: string; stderr: string; code: number; clear?: boolean };

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
  setCwd(path: string): void;
};

export type Command = { name: string; summary: string; run(ctx: CmdContext): CmdResult };

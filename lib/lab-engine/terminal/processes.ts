/** A process on the simulated machine (what `ps` and /proc show). */
export type Proc = {
  pid: number;
  ppid: number;
  user: string;
  /** Command line; kernel threads are a single "[name]". */
  argv: string[];
  state: "R" | "S" | "D" | "Z" | "I" | "T";
  /** Full STAT column for ps aux, e.g. "Ss", "Sl", "R+"; defaults to `state`. */
  stat?: string;
  tty: string;
  /** Start time, "08:55". */
  start: string;
  /** CPU time used, "M:SS". */
  cpuTime: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  env?: Record<string, string>;
};

export type KillResult = "ok" | "ESRCH" | "EPERM" | "IGNORED" | "SHELL";

/** Signals whose default action ends the process (all of 1–15). */
export const SIGNALS = ["HUP", "INT", "QUIT", "ILL", "TRAP", "ABRT", "BUS", "FPE", "KILL", "USR1", "SEGV", "USR2", "PIPE", "ALRM", "TERM"];

/** The kernel's short name for a process: basename of argv[0], at most 15 characters. */
export function commOf(p: Proc): string {
  const first = p.argv[0] ?? "";
  if (first.startsWith("[")) return first.slice(1, -1);
  // "sshd: op@pts/0" style titles keep the program name before the colon.
  const program = first.split(/[: ]/)[0];
  return program.slice(program.lastIndexOf("/") + 1).replace(/^-/, "").slice(0, 15);
}

/** The process list for one shell session: the world's processes plus the learner's shell. */
export class ProcessTable {
  private procs = new Map<number, Proc>();
  private nextPid: number;

  constructor(
    procs: Proc[],
    readonly shellPid: number,
    shell: Proc,
  ) {
    for (const p of procs) this.procs.set(p.pid, structuredClone(p));
    if (!this.procs.has(shellPid)) this.procs.set(shellPid, shell);
    this.nextPid = shellPid + 1;
  }

  list(): Proc[] {
    return [...this.procs.values()].sort((a, b) => a.pid - b.pid);
  }

  get(pid: number): Proc | undefined {
    return this.procs.get(pid);
  }

  /** The command being run right now, as a short-lived process with the next PID. */
  spawnCommand(argv: string[], user: string): Proc {
    return {
      pid: this.nextPid++,
      ppid: this.shellPid,
      user,
      argv,
      state: "R",
      stat: "R+",
      tty: "pts/0",
      start: "10:00",
      cpuTime: "0:00",
      cpu: 0,
      mem: 0.1,
      vsz: 11316,
      rss: 4480,
    };
  }

  kill(pid: number, signal: number, asUser: string): KillResult {
    const p = this.procs.get(pid);
    if (!p) return "ESRCH";
    if (asUser !== "root" && p.user !== asUser) return "EPERM";
    // init can't be killed; an interactive bash ignores SIGTERM.
    if (pid === 1) return "IGNORED";
    if (pid === this.shellPid) return signal === 9 ? "SHELL" : "IGNORED";
    this.procs.delete(pid);
    for (const child of this.procs.values()) if (child.ppid === pid) child.ppid = 1;
    return "ok";
  }
}

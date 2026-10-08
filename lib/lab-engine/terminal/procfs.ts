import { dir, file } from "./build";
import { commOf, type Proc, type ProcessTable } from "./processes";
import { PROC_CPUINFO, PROC_MEMINFO, PROC_UPTIME, PROC_VERSION } from "./sysinfo";
import type { DirNode } from "./types";

const STATE_NAMES: Record<Proc["state"], string> = {
  R: "R (running)",
  S: "S (sleeping)",
  D: "D (disk sleep)",
  Z: "Z (zombie)",
  I: "I (idle)",
  T: "T (stopped)",
};

/** /proc as Linux shows it: one folder per PID plus system files. Read-only, rebuilt on every lookup. */
export function procTree(table: ProcessTable, ids: (user: string) => { uid: number; gid: number }): DirNode {
  const ro = { mode: 0o444 };
  const children: Record<string, DirNode | ReturnType<typeof file>> = {
    version: file(PROC_VERSION, ro),
    cpuinfo: file(PROC_CPUINFO, ro),
    meminfo: file(PROC_MEMINFO, ro),
    uptime: file(PROC_UPTIME, ro),
  };
  for (const p of table.list()) {
    const { uid, gid } = ids(p.user);
    const own = { owner: p.user, group: p.user };
    const kernelThread = p.argv[0]?.startsWith("[") ?? false;
    const status =
      `Name:\t${commOf(p)}\nUmask:\t0022\nState:\t${STATE_NAMES[p.state]}\nTgid:\t${p.pid}\nNgid:\t0\nPid:\t${p.pid}\nPPid:\t${p.ppid}\n` +
      `TracerPid:\t0\nUid:\t${uid}\t${uid}\t${uid}\t${uid}\nGid:\t${gid}\t${gid}\t${gid}\t${gid}\n`;
    children[String(p.pid)] = dir(
      {
        cmdline: file(kernelThread ? "" : p.argv.map((a) => `${a}\0`).join(""), { ...own, ...ro }),
        comm: file(`${commOf(p)}\n`, { ...own, mode: 0o644 }),
        status: file(status, { ...own, ...ro }),
        environ: file(Object.entries(p.env ?? {}).map(([k, v]) => `${k}=${v}\0`).join(""), { ...own, mode: 0o400 }),
      },
      { ...own, mode: 0o555 },
    );
  }
  return dir(children, { mode: 0o555 });
}

import type { Network } from "./network";
import type { Proc } from "./processes";
import type { Service } from "./services";

type Meta = { owner: string; group: string; mode: number; mtime: string };

export type FileNode = Meta & { kind: "file"; content: string };
export type DirNode = Meta & { kind: "dir"; children: Record<string, Node> };
export type Node = FileNode | DirNode;

/** The JSON a generator returns and the browser receives: a whole simulated machine. */
export type World = {
  hostname: string;
  user: string;
  home: string;
  root: DirNode;
  env?: Record<string, string>;
  /** Simulated network for ip/ping/dig/curl/ss/traceroute; absent = no network. */
  network?: Network;
  /** Starting umask for the learner's shell; default 0o022. */
  umask?: number;
  /** Running processes (ps, kill, /proc). The learner's own bash is added by the shell. */
  processes?: Proc[];
  /** Services managed by systemd (systemctl). */
  services?: Service[];
  /** PID of the learner's bash (default 2201) and of its parent (default 1). */
  shellPid?: number;
  shellParent?: number;
};

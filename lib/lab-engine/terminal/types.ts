import type { Network } from "./network";

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
};

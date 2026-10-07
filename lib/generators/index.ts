import type { LabEnv } from "@/lib/lab-engine/env";
import type { Rng } from "./rng";
import { filesPerms } from "./terminal/files-perms";
import { firstTerminal } from "./terminal/first-terminal";
import { r0Challenge } from "./terminal/r0-challenge";
import { ipLab } from "./network/ip-lab";
import { reachLab } from "./network/reach-lab";
import { webLab } from "./network/web-lab";
import { scanLab } from "./packet/scan-lab";
import { dnsLab } from "./packet/dns-lab";
import { httpLab } from "./packet/http-lab";

export type GeneratorOutput = { env: LabEnv; answers: Record<string, string> };

// Params come from lab.yaml, so generators validate what they read.
export type Generator = (rng: Rng, params: Record<string, unknown>) => GeneratorOutput;

/** Registered by name; lab.yaml `dataset.generator` picks one. */
export const GENERATORS: Record<string, Generator> = {
  files_perms: filesPerms,
  first_terminal: firstTerminal,
  r0_challenge: r0Challenge,
  ip_lab: ipLab,
  reach_lab: reachLab,
  web_lab: webLab,
  scan_lab: scanLab,
  dns_lab: dnsLab,
  http_lab: httpLab,
};

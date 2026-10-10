import type { World } from "@/lib/lab-engine/terminal/types";
import type { Capture } from "@/lib/lab-engine/packet/types";
import type { Lab } from "@/lib/lab-engine/lab-schema";
import type { WebAppEnv } from "@/lib/lab-engine/webapp/types";
import type { SiemEnv } from "@/lib/lab-engine/siem/types";

export type LabEnv =
  | { kind: "terminal"; world: World }
  | { kind: "packet"; capture: Capture }
  | { kind: "webapp"; app: WebAppEnv }
  | { kind: "siem"; siem: SiemEnv };

export function assertEnvMatchesLab(lab: Pick<Lab, "id" | "type">, env: LabEnv): void {
  if (lab.type !== env.kind) {
    throw new Error(`lab ${lab.id}: generator returned ${env.kind} env for a ${lab.type} lab`);
  }
}

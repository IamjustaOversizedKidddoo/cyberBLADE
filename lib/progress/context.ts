import "server-only";
import { loadChecks } from "@/lib/content/checks-server";
import { getLesson, getLessons } from "@/lib/content/lessons";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { loadLab } from "@/lib/lab-engine/labs";
import { FileProgressRepo } from "./file-repo";
import type { Ctx } from "./service";

/** The single swap point for the hosted phase (Supabase repo + operator store). */
export function getCtx(): Ctx {
  return {
    repo: new FileProgressRepo(),
    operators: getOperatorStore(),
    content: { getLesson, getLessons, loadChecks, loadLab: (id) => loadLab(id) },
    now: () => new Date(),
  };
}

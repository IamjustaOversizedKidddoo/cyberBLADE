import "server-only";
import { loadChecks } from "@/lib/content/checks-server";
import { getLesson, getLessons } from "@/lib/content/lessons";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { listLabs, loadLab } from "@/lib/lab-engine/labs";
import { FileProgressRepo } from "./file-repo";
import { SupabaseProgressRepo } from "./supabase-repo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Ctx } from "./service";

/** The single swap point for the hosted phase (Supabase repo + operator store). */
export function getCtx(): Ctx {
  return {
    repo: isSupabaseConfigured() ? new SupabaseProgressRepo() : new FileProgressRepo(),
    operators: getOperatorStore(),
    content: { getLesson, getLessons, loadChecks, loadLab: (id) => loadLab(id), listLabs: () => listLabs() },
    now: () => new Date(),
  };
}

import type { Lesson } from "./schema";

/** Published lessons are always visible; drafts and reviewed lessons only when drafts are enabled. */
export function isVisible(lesson: Pick<Lesson, "status">, showDrafts: boolean): boolean {
  return lesson.status === "published" || showDrafts;
}

export function showDrafts(): boolean {
  return process.env.NEON_SHOW_DRAFTS === "true";
}

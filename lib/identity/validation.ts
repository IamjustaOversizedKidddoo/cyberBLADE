import { z } from "zod";
import { safeNextPath } from "./routes";

export const HANDLE_ERROR = "Use 3–20 letters, numbers or _";
export const AGREE_ERROR = "You must accept the agreement to continue";

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, HANDLE_ERROR);

export type StartFormResult =
  | { ok: true; handle: string; next: string }
  | { ok: false; errors: { handle?: string; agree?: string } };

export function parseStartForm(form: FormData): StartFormResult {
  const handle = handleSchema.safeParse(String(form.get("handle") ?? ""));
  const agreed = form.get("agree") === "on";
  if (handle.success && agreed) {
    return { ok: true, handle: handle.data, next: safeNextPath(form.get("next")?.toString()) };
  }
  const errors: { handle?: string; agree?: string } = {};
  if (!handle.success) errors.handle = HANDLE_ERROR;
  if (!agreed) errors.agree = AGREE_ERROR;
  return { ok: false, errors };
}

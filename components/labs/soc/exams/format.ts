/** Client-safe display helpers for the exam screens. */

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
}

/** "12 minutes 5 seconds" style, for screen-reader announcements. */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (!h && sec) parts.push(`${sec} second${sec === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" ") : "no time";
}

export function minutesText(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60 ? `${seconds % 60} s` : ""}`.trim();
}

export const BUDGET_NAMES: Record<string, string> = { queries: "Log searches", lookups: "Enrichment lookups", questionAnswers: "Question answers" };

export const FLAG_NAMES: Record<string, string> = {
  rapid_decisions: "Very fast decisions",
  budget_exhausted: "Budget fully used",
  auto_submitted: "Submitted when time ran out",
  idle_majority: "Long idle periods",
};

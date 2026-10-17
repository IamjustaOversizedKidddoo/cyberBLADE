/**
 * Shared exam timer utilities. Server-authoritative calculations.
 */

export function calculateDeadlineAt(
  startedAt: Date | string,
  durationMinutes: number,
  timeMultiplier: number = 1,
): string {
  const startMs = typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
  const totalSeconds = Math.round(durationMinutes * 60 * timeMultiplier);
  return new Date(startMs + totalSeconds * 1000).toISOString();
}

export function timeRemainingSeconds(deadlineAt: string, now: Date | string = new Date()): number {
  const deadlineMs = Date.parse(deadlineAt);
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  return Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
}

export function isExamExpired(deadlineAt: string, now: Date | string = new Date()): boolean {
  return timeRemainingSeconds(deadlineAt, now) <= 0;
}

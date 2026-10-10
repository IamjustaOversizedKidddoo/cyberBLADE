export type Service = {
  name: string;
  description: string;
  unitPath: string;
  enabled: "enabled" | "disabled" | "static";
  active: "active" | "inactive" | "failed";
  sub: "running" | "exited" | "dead" | "failed";
  since?: string;
  mainPid?: number;
  result?: string;
};

/** Compute human elapsed string against the fixed now (Wed 2026-10-07 10:00:00 IST). */
export function formatElapsed(sinceStr: string): string {
  const match = sinceStr.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return "";
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  const nowSec = 10 * 3600;
  const sinceSec = h * 3600 + m * 60 + s;
  const diffSec = Math.max(0, nowSec - sinceSec);
  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}min ago` : `${hours}h ago`;
  }
  return `${mins}min ago`;
}

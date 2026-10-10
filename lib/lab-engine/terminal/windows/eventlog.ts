import type { WinEvent } from "./types";

export type EventFilter = {
  logName?: string;
  id?: number;
  maxEvents?: number;
};

/** Filters event logs according to specified criteria. */
export function filterEvents(events: WinEvent[] | undefined, filter: EventFilter): WinEvent[] {
  if (!events || events.length === 0) return [];

  let result = [...events];

  if (filter.logName) {
    const targetLog = filter.logName.toLowerCase();
    result = result.filter((e) => e.logName.toLowerCase() === targetLog);
  }

  if (filter.id !== undefined) {
    result = result.filter((e) => e.id === filter.id);
  }

  if (filter.maxEvents && filter.maxEvents > 0) {
    result = result.slice(0, filter.maxEvents);
  }

  return result;
}

/** Formats a list of events into PowerShell's standard Get-WinEvent table. */
export function formatWinEventTable(events: WinEvent[]): string {
  if (events.length === 0) return "";

  const header = "TimeCreated           Id LevelDisplayName Message\n-----------           -- ---------------- -------\n";

  const rows = events.map((e) => {
    const time = e.timeCreated.padEnd(21);
    const id = String(e.id).padStart(4);
    const level = (e.levelDisplayName ?? "Information").padEnd(16);
    // Single line summary of message
    const msg = e.message.split("\n")[0]?.trim() ?? "";
    return `${time} ${id} ${level} ${msg}`;
  });

  return header + rows.join("\n") + "\n";
}

/** Formats an event in Get-WinEvent | Format-List detailed view. */
export function formatWinEventList(events: WinEvent[]): string {
  if (events.length === 0) return "";

  const blocks = events.map((e) => {
    const lines: string[] = [
      `TimeCreated  : ${e.timeCreated}`,
      `ProviderName : ${e.logName === "Security" ? "Microsoft-Windows-Security-Auditing" : e.logName}`,
      `Id           : ${e.id}`,
      `Message      : ${e.message}`,
    ];
    if (e.data) {
      for (const [k, v] of Object.entries(e.data)) {
        lines.push(`               ${k}: ${v}`);
      }
    }
    return lines.join("\n");
  });

  return blocks.join("\n\n") + "\n";
}

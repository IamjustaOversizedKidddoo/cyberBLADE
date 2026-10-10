import { describe, expect, it } from "vitest";
import { filterEvents, formatWinEventList, formatWinEventTable } from "@/lib/lab-engine/terminal/windows/eventlog";
import type { WinEvent } from "@/lib/lab-engine/terminal/windows/types";

describe("Windows Event Log helpers", () => {
  const events: WinEvent[] = [
    {
      logName: "Security",
      id: 4624,
      levelDisplayName: "Information",
      timeCreated: "10/7/2026 9:15:22 AM",
      message: "An account was successfully logged on.",
      data: { TargetUserName: "operator", LogonType: "2" },
    },
    {
      logName: "Security",
      id: 4625,
      levelDisplayName: "Information",
      timeCreated: "10/7/2026 9:14:05 AM",
      message: "An account failed to log on.",
      data: { TargetUserName: "administrator", FailureReason: "%%2313" },
    },
    {
      logName: "System",
      id: 7045,
      levelDisplayName: "Information",
      timeCreated: "10/7/2026 9:12:00 AM",
      message: "A service was installed in the system.",
      data: { ServiceName: "MaliciousSvc", ImagePath: "C:\\Users\\public\\mal.exe" },
    },
  ];

  it("filters events by logName and Id", () => {
    const secEvents = filterEvents(events, { logName: "Security" });
    expect(secEvents).toHaveLength(2);

    const failedLogons = filterEvents(events, { logName: "Security", id: 4625 });
    expect(failedLogons).toHaveLength(1);
    expect(failedLogons[0].data?.TargetUserName).toBe("administrator");

    const limited = filterEvents(events, { maxEvents: 1 });
    expect(limited).toHaveLength(1);
  });

  it("formats table and list views matching PowerShell expectations", () => {
    const table = formatWinEventTable(events);
    expect(table).toContain("TimeCreated           Id LevelDisplayName Message");
    expect(table).toContain("4624 Information");
    expect(table).toContain("7045 Information");

    const list = formatWinEventList(events.slice(0, 1));
    expect(list).toContain("Id           : 4624");
    expect(list).toContain("TargetUserName: operator");
  });
});

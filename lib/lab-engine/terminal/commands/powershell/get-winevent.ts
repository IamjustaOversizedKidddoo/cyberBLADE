import { filterEvents, formatWinEventTable } from "../../windows/eventlog";
import type { Command } from "../types";
import { fail, ok } from "../util";

export const getWinEvent: Command = {
  name: "Get-WinEvent",
  summary: "get events from event logs and event tracing log files",
  run(ctx) {
    const args = ctx.argv.slice(1);
    let logName = "";
    let id: number | undefined;
    let maxEvents: number | undefined;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if ((a === "-LogName" || a === "-Log") && i + 1 < args.length) {
        logName = args[++i];
      } else if ((a === "-Id" || a === "-InstanceId") && i + 1 < args.length) {
        id = Number(args[++i]);
      } else if ((a === "-MaxEvents" || a === "-Newest") && i + 1 < args.length) {
        maxEvents = Number(args[++i]);
      } else if (a.startsWith("-FilterHashtable") || a.startsWith("@{")) {
        // e.g. -FilterHashtable @{LogName='Security';ID=4625}
        const full = args.slice(i).join(" ");
        const logMatch = full.match(/LogName\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i);
        const idMatch = full.match(/I[dD]\s*=\s*(\d+)/);
        if (logMatch) logName = logMatch[1];
        if (idMatch) id = Number(idMatch[1]);
        break;
      } else if (a === "-ListLog") {
        return ok("LogMode   MaximumSizeInBytes RecordCount LogName\n-------   ------------------ ----------- -------\nCircular            20971520        1500 Security\nCircular            20971520         850 System\nCircular            20971520         300 Application\n");
      } else if (!a.startsWith("-") && !logName) {
        logName = a;
      }
    }

    if (!logName && id === undefined) {
      logName = "Security";
    }

    const filtered = filterEvents(ctx.eventLogs, { logName, id, maxEvents });
    if (filtered.length === 0) {
      if (id !== undefined) {
        return ok("");
      }
      return fail(`Get-WinEvent : No events were found that match the specified selection criteria.\n`);
    }

    return ok(formatWinEventTable(filtered));
  },
};

export const getEventLog: Command = {
  ...getWinEvent,
  name: "Get-EventLog",
};

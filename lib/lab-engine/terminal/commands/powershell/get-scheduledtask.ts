import type { Command } from "../types";
import { fail, ok } from "../util";

export const getScheduledTask: Command = {
  name: "Get-ScheduledTask",
  summary: "gets scheduled tasks present on a computer",
  run(ctx) {
    const tasks = ctx.scheduledTasks ?? [];
    const args = ctx.argv.slice(1);
    let nameFilter = "";

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if ((a === "-TaskName" || a === "-Name") && i + 1 < args.length) {
        nameFilter = args[++i];
      } else if (!a.startsWith("-") && !nameFilter) {
        nameFilter = a;
      }
    }

    let filtered = tasks;
    if (nameFilter) {
      const term = nameFilter.replace(/\*/g, "").toLowerCase();
      filtered = tasks.filter((t) => t.taskName.toLowerCase().includes(term));
      if (filtered.length === 0) {
        return fail(`Get-ScheduledTask : No matching tasks found for '${nameFilter}'.\n`);
      }
    }

    const header = "TaskPath                                TaskName                          State\n--------                                --------                          -----\n";
    const rows = filtered.map((t) => {
      const path = (t.taskPath ?? "\\").padEnd(39);
      const name = t.taskName.padEnd(33);
      const state = t.state;
      return `${path} ${name} ${state}`;
    });

    return ok(header + rows.join("\n") + "\n");
  },
};

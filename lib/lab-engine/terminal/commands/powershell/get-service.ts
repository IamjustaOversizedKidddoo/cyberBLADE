import type { Command } from "../types";
import { fail, ok } from "../util";

export const getService: Command = {
  name: "Get-Service",
  summary: "gets the services on a computer",
  run(ctx) {
    const services = ctx.services ?? [];
    const args = ctx.argv.slice(1);
    let nameFilter = "";

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-Name" && i + 1 < args.length) {
        nameFilter = args[++i];
      } else if (!a.startsWith("-") && !nameFilter) {
        nameFilter = a;
      }
    }

    let filtered = services;
    if (nameFilter) {
      const term = nameFilter.replace(/\*/g, "").toLowerCase();
      filtered = services.filter((s) => s.name.toLowerCase().includes(term));
      if (filtered.length === 0) {
        return fail(`Get-Service : Cannot find any service with service name '${nameFilter}'.\n`);
      }
    }

    const header = "Status   Name               DisplayName\n------   ----               -----------\n";
    const rows = filtered.map((s) => {
      const status = (s.active ? "Running" : "Stopped").padEnd(8);
      const name = s.name.padEnd(18);
      const desc = s.description;
      return `${status} ${name} ${desc}`;
    });

    return ok(header + rows.join("\n") + "\n");
  },
};

export const gsv: Command = {
  ...getService,
  name: "gsv",
};

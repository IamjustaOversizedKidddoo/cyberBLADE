import { commOf } from "../processes";
import { formatElapsed } from "../services";
import type { Command } from "./types";
import { fail, ok } from "./util";

export const systemctl: Command = {
  name: "systemctl",
  summary: "control the systemd system and service manager",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const services = ctx.services ?? [];

    if (args.length === 0 || args[0] === "status") {
      const rawName = args[1] ?? "";
      if (!rawName) {
        return fail("systemctl: missing service name\n");
      }
      const unitName = rawName.endsWith(".service") ? rawName.slice(0, -".service".length) : rawName;
      const s = services.find((x) => x.name === unitName || x.name === `${unitName}.service`);
      if (!s) {
        return fail(`Unit ${unitName}.service could not be found.\n`, 4);
      }

      const symbol = s.active === "active" ? "●" : s.active === "failed" ? "×" : "○";
      const lines = [
        `${symbol} ${unitName}.service - ${s.description}`,
        `     Loaded: loaded (${s.unitPath}; ${s.enabled}; preset: enabled)`,
      ];

      if (s.active === "active") {
        const elapsed = s.since ? `; ${formatElapsed(s.since)}` : "";
        lines.push(`     Active: active (${s.sub}) since ${s.since}${elapsed}`);
        const p = s.mainPid ? ctx.procs.get(s.mainPid) : undefined;
        const comm = p ? commOf(p) : unitName;
        const argv = p ? p.argv.join(" ") : unitName;
        lines.push(`   Main PID: ${s.mainPid ?? 0} (${comm})`);
        lines.push(`     CGroup: /system.slice/${unitName}.service`);
        lines.push(`             └─${s.mainPid ?? 0} "${argv}"`);
        return { stdout: lines.join("\n") + "\n", stderr: "", code: 0 };
      }

      if (s.active === "failed") {
        const elapsed = s.since ? `; ${formatElapsed(s.since)}` : "";
        lines.push(`     Active: failed (Result: ${s.result ?? "exit-code"})${s.since ? ` since ${s.since}${elapsed}` : ""}`);
        lines.push(`   Main PID: ${s.mainPid ?? 0} (code=exited, status=1/FAILURE)`);
        return { stdout: lines.join("\n") + "\n", stderr: "", code: 3 };
      }

      // inactive
      lines.push(`     Active: inactive (${s.sub})`);
      return { stdout: lines.join("\n") + "\n", stderr: "", code: 3 };
    }

    if (args[0] === "list-units") {
      let stateFilter: string | undefined;
      for (const a of args.slice(1)) {
        if (a.startsWith("--state=")) stateFilter = a.slice("--state=".length);
      }

      const filtered = services.filter((s) => {
        if (!stateFilter) return true;
        if (stateFilter === "running") return s.sub === "running";
        if (stateFilter === "failed") return s.active === "failed";
        if (stateFilter === "active") return s.active === "active";
        return true;
      });

      const unitWidth = Math.max(16, ...filtered.map((s) => `${s.name}.service`.length));
      const header = `  UNIT${" ".repeat(Math.max(1, unitWidth - 4 + 2))}LOAD   ACTIVE SUB     DESCRIPTION`;
      const rows = filtered.map((s) => {
        const prefix = s.active === "failed" ? "● " : "  ";
        const unit = `${s.name}.service`.padEnd(unitWidth + 2);
        const load = "loaded".padEnd(7);
        const active = s.active.padEnd(7);
        const sub = s.sub.padEnd(8);
        return `${prefix}${unit}${load}${active}${sub}${s.description}`;
      });

      const body = [
        header,
        ...rows,
        "",
        "Legend: LOAD   = Reflects whether the unit definition was properly loaded.",
        "        ACTIVE = The high-level unit activation state, i.e. generalization of SUB.",
        "        SUB    = The low-level unit activation state, values depend on unit type.",
        "",
        `${filtered.length} loaded units listed. Pass --all to see loaded but inactive units, too.`,
        "To show all installed unit files use 'systemctl list-unit-files'.",
        "",
      ].join("\n");

      return ok(body);
    }

    if (args[0] === "is-active") {
      const rawName = args[1] ?? "";
      const unitName = rawName.endsWith(".service") ? rawName.slice(0, -".service".length) : rawName;
      const s = services.find((x) => x.name === unitName || x.name === `${unitName}.service`);
      if (!s) return { stdout: "unknown\n", stderr: "", code: 3 };
      return { stdout: `${s.active}\n`, stderr: "", code: s.active === "active" ? 0 : 3 };
    }

    if (args[0] === "is-enabled") {
      const rawName = args[1] ?? "";
      const unitName = rawName.endsWith(".service") ? rawName.slice(0, -".service".length) : rawName;
      const s = services.find((x) => x.name === unitName || x.name === `${unitName}.service`);
      if (!s) return { stdout: "unknown\n", stderr: "", code: 3 };
      return { stdout: `${s.enabled}\n`, stderr: "", code: s.enabled === "enabled" ? 0 : 3 };
    }

    return fail("systemctl: this lab can only inspect services (status, list-units, is-active, is-enabled)\n");
  },
};

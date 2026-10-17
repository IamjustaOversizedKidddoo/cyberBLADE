import type { NetRangeHost, NetRangeScenario, NetRangeState } from "../types";
import { isIpInSubnet } from "../lint";

export function parseArgv(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}

export function isTargetRoutable(targetIp: string, activeRoutes: string[]): boolean {
  return activeRoutes.some((route) => isIpInSubnet(targetIp, route));
}

export function findHostByIpOrName(
  scenario: NetRangeScenario,
  identifier: string,
): NetRangeHost | undefined {
  const clean = identifier.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].toLowerCase();
  return scenario.hosts.find(
    (h) =>
      h.hostname.toLowerCase() === clean ||
      h.interfaces.some((iface) => iface.ip === clean),
  );
}

export function formatPrompt(state: NetRangeState, scenario: NetRangeScenario): string {
  if (state.msfContext !== undefined) {
    if (state.msfContext.selectedModule) {
      return `msf6 exploit(${state.msfContext.selectedModule}) > `;
    }
    return "msf6 > ";
  }

  if (!state.currentHostId) {
    return "kali@kali:~$ ";
  }

  const host = scenario.hosts.find((h) => h.id === state.currentHostId);
  const hostname = host?.hostname ?? "remote";
  const user = state.currentUser;
  const isRoot = user === "root" || user === "Administrator";
  const symbol = host?.os === "windows" ? ">" : isRoot ? "#" : "$";

  if (host?.os === "windows") {
    return `${state.currentCwd}${symbol} `;
  }
  return `${user}@${hostname}:${state.currentCwd}${symbol} `;
}

import type { NetRangeScenario, NetRangeState } from "../types";
import { findHostByIpOrName } from "./util";
import { isIpInSubnet } from "../lint";

export function execRoute(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState } {
  // If just "route" or "route -n" or "ip route [show|list]"
  if (
    argv.length === 1 ||
    (argv.length === 2 &&
      (argv[1] === "-n" || argv[1] === "show" || argv[1] === "list" || argv[1] === "s" || argv[1] === "l"))
  ) {
    const lines = [
      "Kernel IP routing table",
      "Destination     Gateway         Genmask         Flags Metric Ref    Use Iface",
      "0.0.0.0         192.0.2.1       0.0.0.0         UG    100    0        0 eth0",
    ];
    for (const r of state.routes) {
      const [dest, prefix] = r.split("/");
      const genmask = prefix === "24" ? "255.255.255.0" : prefix === "16" ? "255.255.0.0" : "255.0.0.0";
      lines.push(`${dest.padEnd(16)}0.0.0.0         ${genmask.padEnd(16)}U     100    0        0 eth0`);
    }
    return { stdout: lines.join("\n") + "\n", stderr: "", code: 0 };
  }

  // route add <subnet> via <gw> OR route add -net <subnet> gw <gw>
  let targetSubnet = "";
  let viaIp = "";

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "add" && i + 1 < argv.length) {
      if (argv[i + 1] === "-net") i++;
      targetSubnet = argv[++i];
    } else if (a === "via" || a === "gw") {
      if (i + 1 < argv.length) viaIp = argv[++i];
    } else if (a.includes("/") && !targetSubnet) {
      targetSubnet = a;
    }
  }

  if (!targetSubnet || !viaIp) {
    return {
      stdout: "",
      stderr: "Usage: route add <subnet_cidr> via <gateway_ip>\nExample: route add 172.16.50.0/24 via 192.0.2.100\n",
      code: 1,
    };
  }

  // Check pivot rule
  const host = findHostByIpOrName(scenario, viaIp);
  if (!host) {
    return { stdout: "", stderr: `route: SIOCADDRT: Network is unreachable (Gateway ${viaIp} unknown)\n`, code: 1 };
  }

  // Check if gateway host is dual-homed on target subnet
  const hasSubnetInterface = host.interfaces.some((iface) => isIpInSubnet(iface.ip, targetSubnet));
  if (!hasSubnetInterface) {
    return { stdout: "", stderr: `route: SIOCADDRT: Invalid argument (Host ${host.hostname} is not connected to ${targetSubnet})\n`, code: 1 };
  }

  // Check if pivot rule requires compromise
  const pivotRule = scenario.pivotRules?.find(
    (r) => r.targetSubnet === targetSubnet && (r.viaHost === host.id || r.viaHost === host.hostname || host.interfaces.some((i) => i.ip === r.viaHost)),
  );

  if (pivotRule?.requiresCompromise) {
    const hasSession = state.sessions.some((s) => s.hostId === host.id);
    const hasDownloadedCreds = Object.values(state.downloadedFiles).some((content) =>
      host.users.some((u) => content.includes(u.username)),
    );
    if (!hasSession && !hasDownloadedCreds) {
      return {
        stdout: "",
        stderr: `[-] Cannot establish pivot route: Host ${host.hostname} (${viaIp}) has not been compromised yet.\n`,
        code: 1,
      };
    }
  }

  const nextState: NetRangeState = {
    ...state,
    routes: state.routes.includes(targetSubnet) ? state.routes : [...state.routes, targetSubnet],
  };

  return {
    stdout: `[+] Route added for ${targetSubnet} via ${viaIp} (${host.hostname})\n`,
    stderr: "",
    code: 0,
    nextState,
  };
}

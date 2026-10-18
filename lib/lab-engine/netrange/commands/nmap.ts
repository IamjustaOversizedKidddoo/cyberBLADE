import type { NetRangeHost, NetRangeScenario, NetRangeState } from "../types";
import { findHostByIpOrName, isTargetRoutable } from "./util";
import { isIpInSubnet } from "../lint";

export function execNmap(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState } {
  let hasVersion = false;
  let hasScripts = false;
  let hasOs = false;
  let hasPn = false;
  let isSynScan = false;
  let requestedPorts: number[] | null = null;
  let allPorts = false;
  let outputFile: string | null = null;
  const targets: string[] = [];

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-sV" || arg === "-sC" || arg === "-A" || arg === "-sS" || arg === "-sT" || arg === "-O" || arg === "-Pn") {
      if (arg === "-sV" || arg === "-A") hasVersion = true;
      if (arg === "-sC" || arg === "-A") hasScripts = true;
      if (arg === "-O" || arg === "-A") hasOs = true;
      if (arg === "-sS") isSynScan = true;
      if (arg === "-Pn") hasPn = true;
    } else if (arg === "-p-") {
      allPorts = true;
    } else if (arg === "-p") {
      i++;
      if (i < argv.length) {
        requestedPorts = argv[i].split(",").map((p) => Number(p.trim())).filter((n) => !isNaN(n));
      }
    } else if (arg.startsWith("-p")) {
      const rest = arg.slice(2);
      requestedPorts = rest.split(",").map((p) => Number(p.trim())).filter((n) => !isNaN(n));
    } else if (arg === "-oN" && i + 1 < argv.length) {
      outputFile = argv[++i];
    } else if (arg.startsWith("-oN=")) {
      outputFile = arg.slice(5);
    } else if (!arg.startsWith("-")) {
      targets.push(arg);
    }
  }

  if (targets.length === 0) {
    return {
      stdout: "",
      stderr: "nmap: missing target specification (e.g. nmap 192.0.2.10 or nmap -sV -sC 192.0.2.0/24)\n",
      code: 1,
    };
  }

  const out: string[] = [];
  out.push("Starting Nmap 7.94 ( https://nmap.org ) at 2026-10-17 11:50 UTC");
  if (isSynScan) {
    out.push("Scanning with SYN Stealth Scan (half-open probes)");
  }

  let hostsScanned = 0;
  let hostsUp = 0;

  for (const target of targets) {
    // Check if target is a CIDR subnet sweep
    if (target.includes("/")) {
      const matchingHosts = scenario.hosts.filter((h) =>
        h.interfaces.some((iface) => isIpInSubnet(iface.ip, target)),
      );

      for (const host of matchingHosts) {
        hostsScanned++;
        const targetIp = host.interfaces.find((iface) => isIpInSubnet(iface.ip, target))?.ip ?? host.interfaces[0].ip;
        if (!isTargetRoutable(targetIp, state.routes)) {
          continue;
        }
        hostsUp++;
        formatHostScan(host, targetIp, out, hasVersion, hasScripts, hasOs, requestedPorts, allPorts);
      }
    } else {
      hostsScanned++;
      const host = findHostByIpOrName(scenario, target);
      if (!host) {
        if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(target)) {
          out.push(`Nmap scan report for ${target}`);
          if (hasPn) {
            out.push("Host is up.");
            out.push(`All 1000 scanned ports on ${target} are in ignored states.`);
            out.push("Not shown: 1000 filtered tcp ports (no-response)");
          } else {
            out.push("Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn");
          }
        } else {
          out.push(`Failed to resolve "${target}".`);
        }
        continue;
      }

      const iface = host.interfaces.find((i) => i.ip === target) ?? host.interfaces[0];
      const targetIp = iface.ip;

      if (!isTargetRoutable(targetIp, state.routes)) {
        if (hasPn) {
          out.push(`Nmap scan report for ${host.hostname} (${targetIp})`);
          out.push("Host is up.");
          out.push("All 1000 scanned ports on " + host.hostname + " (" + targetIp + ") are in ignored states.");
          out.push("Not shown: 1000 filtered tcp ports (no-response)");
        } else {
          out.push(`Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn`);
          out.push(`Nmap done: 1 IP address (0 hosts up) scanned in 2.05 seconds`);
          continue;
        }
      } else {
        hostsUp++;
        formatHostScan(host, targetIp, out, hasVersion, hasScripts, hasOs, requestedPorts, allPorts);
      }
    }
  }

  out.push(`Nmap done: ${hostsScanned} IP address (${hostsUp} host${hostsUp === 1 ? "" : "s"} up) scanned in 0.42 seconds`);
  const stdout = out.join("\n") + "\n";

  let nextState: NetRangeState | undefined;
  if (outputFile) {
    nextState = {
      ...state,
      downloadedFiles: {
        ...state.downloadedFiles,
        [outputFile]: stdout,
      },
    };
  }

  return { stdout, stderr: "", code: 0, nextState };
}

function formatHostScan(
  host: NetRangeHost,
  ip: string,
  out: string[],
  hasVersion: boolean,
  hasScripts: boolean,
  hasOs: boolean,
  requestedPorts: number[] | null,
  _allPorts: boolean,
) {
  out.push(`Nmap scan report for ${host.hostname} (${ip})`);
  out.push(`Host is up (0.00062s latency).`);

  let services = host.services;
  if (requestedPorts && requestedPorts.length > 0) {
    services = services.filter((s) => requestedPorts.includes(s.port));
  }

  if (services.length === 0) {
    out.push("All scanned ports are closed or filtered.");
    out.push("");
    return;
  }

  out.push(`PORT     STATE SERVICE     VERSION`);
  for (const s of services) {
    const portStr = `${s.port}/${s.protocol ?? "tcp"}`.padEnd(9);
    const stateStr = (s.state ?? "open").padEnd(6);
    const serviceStr = s.name.padEnd(12);
    const versionStr = hasVersion ? s.version ?? "" : "";
    out.push(`${portStr}${stateStr}${serviceStr}${versionStr}`);

    if (hasScripts && s.scripts) {
      for (const [scriptName, scriptOut] of Object.entries(s.scripts)) {
        out.push(`|_ ${scriptName}: ${scriptOut}`);
      }
    }
  }

  if (hasOs) {
    if (host.os === "linux") {
      out.push("Device type: general purpose");
      out.push("Running: Linux 5.X|4.X");
      out.push("OS CPE: cpe:/o:linux:linux_kernel:5");
      out.push("OS details: Linux 5.4 - 5.10");
      out.push("Network Distance: 1 hop");
    } else {
      out.push("Device type: general purpose");
      out.push("Running: Microsoft Windows Server 2019");
      out.push("OS CPE: cpe:/o:microsoft:windows_server_2019");
      out.push("OS details: Microsoft Windows Server 2019 Standard");
      out.push("Network Distance: 1 hop");
    }
  }

  out.push("");
}

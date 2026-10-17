import { parseNetRangeScenario } from "./schema";
import type { NetRangeScenario } from "./types";

export type ScenarioLintResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function ipToNumber(ip: string): number {
  return ip
    .split(".")
    .map(Number)
    .reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}

function parseCidr(cidr: string): { network: number; mask: number; size: number } {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (ipToNumber(ip) & mask) >>> 0;
  return { network, mask, size: Math.pow(2, 32 - prefix) };
}

export function isIpInSubnet(ip: string, subnetCidr: string): boolean {
  const { network, mask } = parseCidr(subnetCidr);
  const ipNum = ipToNumber(ip);
  return (ipNum & mask) >>> 0 === network;
}

/** Check if IP is in RFC 5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) */
export function isDocumentationOrPrivateIp(ip: string): boolean {
  return (
    isIpInSubnet(ip, "192.0.2.0/24") ||
    isIpInSubnet(ip, "198.51.100.0/24") ||
    isIpInSubnet(ip, "203.0.113.0/24") ||
    isIpInSubnet(ip, "10.0.0.0/8") ||
    isIpInSubnet(ip, "172.16.0.0/12") ||
    isIpInSubnet(ip, "192.168.0.0/16")
  );
}

export function lintNetRangeScenario(data: unknown): ScenarioLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let scenario: NetRangeScenario;
  try {
    scenario = parseNetRangeScenario(data);
  } catch (err: unknown) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings: [],
    };
  }

  // 1. Check subnets
  const subnetCidrs = new Set(scenario.subnets.map((s) => s.cidr));
  const hasEntrypoint = scenario.subnets.some((s) => s.accessibleFromStart);
  if (!hasEntrypoint) {
    errors.push("At least one subnet must have accessibleFromStart: true.");
  }

  // 2. Check hosts and interfaces
  const seenIps = new Set<string>();
  const hostMap = new Map(scenario.hosts.map((h) => [h.id, h]));

  for (const host of scenario.hosts) {
    // Unique ports check
    const ports = new Set<number>();
    for (const svc of host.services) {
      if (ports.has(svc.port)) {
        errors.push(`Host '${host.id}' has duplicate service on port ${svc.port}.`);
      }
      ports.add(svc.port);
    }

    // Interfaces check
    for (const iface of host.interfaces) {
      if (!isDocumentationOrPrivateIp(iface.ip)) {
        errors.push(
          `Host '${host.id}' has non-documentation / non-private IP ${iface.ip}. Must be RFC 5737 or RFC 1918.`,
        );
      }
      if (!subnetCidrs.has(iface.subnet)) {
        errors.push(
          `Host '${host.id}' interface ${iface.ip} belongs to undefined subnet ${iface.subnet}.`,
        );
      } else if (!isIpInSubnet(iface.ip, iface.subnet)) {
        errors.push(
          `Host '${host.id}' interface ${iface.ip} does not fall within declared subnet ${iface.subnet}.`,
        );
      }

      if (seenIps.has(iface.ip)) {
        errors.push(`Duplicate IP detected across hosts: ${iface.ip}`);
      }
      seenIps.add(iface.ip);
    }

    // Users check
    if (host.users.length === 0) {
      warnings.push(`Host '${host.id}' has no configured users.`);
    }

    // Vulnerabilities check
    if (host.vulnerabilities) {
      for (const vuln of host.vulnerabilities) {
        if (vuln.port && !host.services.some((s) => s.port === vuln.port)) {
          warnings.push(
            `Vuln '${vuln.id}' targets port ${vuln.port} which is not open on host '${host.id}'.`,
          );
        }
      }
    }
  }

  // 3. Pivot rules check
  if (scenario.pivotRules) {
    for (const rule of scenario.pivotRules) {
      const viaHost = hostMap.get(rule.viaHost);
      if (!viaHost) {
        errors.push(`Pivot rule references non-existent viaHost '${rule.viaHost}'.`);
      } else {
        const hasTargetSubnetInterface = viaHost.interfaces.some((iface) =>
          isIpInSubnet(iface.ip, rule.targetSubnet),
        );
        if (!hasTargetSubnetInterface) {
          warnings.push(
            `viaHost '${viaHost.id}' does not possess an interface directly on targetSubnet ${rule.targetSubnet}.`,
          );
        }
      }
      if (!subnetCidrs.has(rule.targetSubnet)) {
        errors.push(`Pivot rule references undefined targetSubnet ${rule.targetSubnet}.`);
      }
    }
  }

  // 4. Flags check
  for (const flag of scenario.flags) {
    const host = hostMap.get(flag.hostId);
    if (!host) {
      errors.push(`Flag '${flag.id}' references non-existent hostId '${flag.hostId}'.`);
    } else if (flag.path && host.filesystem && !host.filesystem[flag.path]) {
      warnings.push(
        `Flag '${flag.id}' specifies path '${flag.path}' not directly present in host filesystem map.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

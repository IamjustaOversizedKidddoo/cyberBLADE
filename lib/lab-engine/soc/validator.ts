import { socScenarioSchema, toClientView, type SocScenario } from "./schema";

const DENIED_CLIENT_KEYS = [
  "groundTruth",
  "kind",
  "correctDisposition",
  "correctSeverity",
  "correctEscalation",
  "incidentId",
  "incidents",
  "rootCause",
  "debrief",
  "acceptableAlternatives",
];

// RFC 5737 documentation ranges & RFC 1918 private ranges & Loopback
function isAllowedIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12 (172.16 - 172.31)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // RFC 5737: 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // RFC 5737: 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // RFC 5737: 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  return false;
}

const ALLOWED_DOMAIN_SUFFIXES = [
  ".example",
  ".test",
  ".invalid",
  ".localhost",
  ".corp.internal",
  ".internal",
  ".lan",
  ".local",
  "example.com",
  "example.org",
  "example.net",
];

function isAllowedDomain(domain: string): boolean {
  const lower = domain.toLowerCase().trim();
  return ALLOWED_DOMAIN_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(suffix));
}

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validates a SocScenario object according to all Part B2 integrity and anti-leak rules.
 */
export function validateSocScenario(raw: unknown, filename = "scenario"): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Zod schema validation
  const parsed = socScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${filename}: ${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors, warnings };
  }

  const scenario = parsed.data;

  // 2. ID Uniqueness
  const alertIds = new Set<string>();
  for (const alert of scenario.alerts) {
    if (alertIds.has(alert.id)) {
      errors.push(`${filename}: Duplicate alert id '${alert.id}'`);
    }
    alertIds.add(alert.id);
  }

  const rawEventIds = new Set<string>();
  for (const event of scenario.rawEvents) {
    if (rawEventIds.has(event.id)) {
      errors.push(`${filename}: Duplicate raw event id '${event.id}'`);
    }
    rawEventIds.add(event.id);
  }

  const assetIds = new Set<string>();
  const assetHostnames = new Set<string>();
  for (const asset of scenario.environment.assets) {
    if (assetIds.has(asset.id)) errors.push(`${filename}: Duplicate asset id '${asset.id}'`);
    assetIds.add(asset.id);
    assetHostnames.add(asset.hostname.toLowerCase());
  }

  const userIds = new Set<string>();
  const usernames = new Set<string>();
  for (const user of scenario.environment.users) {
    if (userIds.has(user.id)) errors.push(`${filename}: Duplicate user id '${user.id}'`);
    userIds.add(user.id);
    usernames.add(user.username.toLowerCase());
  }

  const incidentIds = new Set<string>();
  for (const inc of scenario.groundTruth.incidents) {
    if (incidentIds.has(inc.id)) errors.push(`${filename}: Duplicate incident id '${inc.id}'`);
    incidentIds.add(inc.id);
  }

  // 3. Reference resolution
  for (const alert of scenario.alerts) {
    if (alert.relatedAsset && !assetIds.has(alert.relatedAsset) && !assetHostnames.has(alert.relatedAsset.toLowerCase())) {
      errors.push(`${filename}: Alert '${alert.id}' references unknown asset '${alert.relatedAsset}'`);
    }
    if (alert.relatedUser && !userIds.has(alert.relatedUser) && !usernames.has(alert.relatedUser.toLowerCase())) {
      errors.push(`${filename}: Alert '${alert.id}' references unknown user '${alert.relatedUser}'`);
    }
    for (const eventId of alert.linkedRawEvents) {
      if (!rawEventIds.has(eventId)) {
        errors.push(`${filename}: Alert '${alert.id}' references unknown raw event id '${eventId}'`);
      }
    }
    if (alert.groundTruth.incidentId && !incidentIds.has(alert.groundTruth.incidentId)) {
      errors.push(`${filename}: Alert '${alert.id}' references unknown incident id '${alert.groundTruth.incidentId}'`);
    }
  }

  // 4. Ground Truth Integrity: Every incident has >= 1 true positive alert
  for (const inc of scenario.groundTruth.incidents) {
    if (!inc.truePositiveAlertIds.length) {
      errors.push(`${filename}: Incident '${inc.id}' has no true positive alert IDs`);
    }
    for (const aid of inc.truePositiveAlertIds) {
      const match = scenario.alerts.find((a) => a.id === aid);
      if (!match) {
        errors.push(`${filename}: Incident '${inc.id}' references non-existent alert id '${aid}'`);
      } else if (match.groundTruth.kind !== "true_positive") {
        errors.push(`${filename}: Incident '${inc.id}' references alert '${aid}' which is not kind 'true_positive' (kind: '${match.groundTruth.kind}')`);
      }
    }
  }

  // 5. Timestamps check
  for (const alert of scenario.alerts) {
    const t = new Date(alert.timestamp).getTime();
    if (isNaN(t)) errors.push(`${filename}: Alert '${alert.id}' has invalid timestamp '${alert.timestamp}'`);
  }
  for (const event of scenario.rawEvents) {
    const t = new Date(event.timestamp).getTime();
    if (isNaN(t)) errors.push(`${filename}: Event '${event.id}' has invalid timestamp '${event.timestamp}'`);
  }

  // 6. Network/Domain safety: documentation IP & reserved domain enforcement
  for (const asset of scenario.environment.assets) {
    if (!isAllowedIp(asset.ip)) {
      errors.push(`${filename}: Asset '${asset.id}' IP '${asset.ip}' is not an RFC 1918 or RFC 5737 documentation IP`);
    }
  }
  for (const user of scenario.environment.users) {
    const domain = user.email.split("@")[1];
    if (domain && !isAllowedDomain(domain)) {
      errors.push(`${filename}: User '${user.id}' email domain '${domain}' is not an approved internal or reserved domain`);
    }
  }
  for (const alert of scenario.alerts) {
    for (const ioc of alert.relatedIocs) {
      if (ioc.type === "ip" && !isAllowedIp(ioc.value)) {
        errors.push(`${filename}: Alert '${alert.id}' IOC IP '${ioc.value}' is not an RFC 1918 or RFC 5737 documentation IP`);
      }
      if (ioc.type === "domain" && !isAllowedDomain(ioc.value)) {
        errors.push(`${filename}: Alert '${alert.id}' IOC domain '${ioc.value}' is not an approved reserved domain`);
      }
    }
  }

  // 7. Client Projection Deny-List Scan (Verify toClientView never leaks ground truth)
  const clientView = toClientView(scenario);
  const serialized = JSON.stringify(clientView);

  for (const deniedKey of DENIED_CLIENT_KEYS) {
    const regex = new RegExp(`"${deniedKey}"\\s*:`, "i");
    if (regex.test(serialized)) {
      errors.push(`${filename}: CRITICAL LEAK: Client projection contains denied key '${deniedKey}'`);
    }
  }

  // Check overallDebrief and incident rootCause do not leak into serialized clientView
  if (serialized.includes(scenario.groundTruth.overallDebrief)) {
    errors.push(`${filename}: CRITICAL LEAK: Client projection contains scenario overallDebrief text`);
  }
  for (const inc of scenario.groundTruth.incidents) {
    if (serialized.includes(inc.rootCause)) {
      errors.push(`${filename}: CRITICAL LEAK: Client projection contains incident '${inc.id}' root cause text`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

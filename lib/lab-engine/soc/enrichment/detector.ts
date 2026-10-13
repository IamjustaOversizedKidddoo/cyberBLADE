import type { EntityType } from "./types";

/**
 * Defang an indicator (domain, IP, URL) to prevent accidental clicking / rendering
 */
export function defangIndicator(val: string): string {
  if (!val) return "";
  let defanged = val.trim();
  // Replace protocol
  defanged = defanged.replace(/^https?:\/\//i, (match) =>
    match.toLowerCase().startsWith("https") ? "hxxps://" : "hxxp://",
  );
  // Replace dots in domain/IP portions
  defanged = defanged.replace(/([a-zA-Z0-9_-])\.([a-zA-Z0-9_-])/g, "$1[.]$2");
  return defanged;
}

/**
 * Refang a defanged indicator back to standard notation for backend querying
 */
export function refangIndicator(val: string): string {
  if (!val) return "";
  let refanged = val.trim();
  refanged = refanged.replace(/hxxps?:\/\//i, (match) =>
    match.toLowerCase().startsWith("hxxps") ? "https://" : "http://",
  );
  refanged = refanged.replace(/\[\.\]/g, ".");
  refanged = refanged.replace(/\[:\]/g, ":");
  return refanged;
}

/**
 * Canonicalize and sanitize an indicator string
 */
export function canonicalizeIndicator(val: string): string {
  const refanged = refangIndicator(val);
  return refanged.trim().toLowerCase();
}

/**
 * Canonicalize an entity according to its specific EntityType
 */
export function canonicalizeEntity(type: EntityType, val: string): string {
  if (!val) return "";
  const refanged = refangIndicator(val).trim();
  if (type === "ip" || type === "domain" || type === "hash" || type === "email") {
    return refanged.toLowerCase();
  }
  return refanged;
}

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|:(:[0-9a-fA-F]{1,4}){1,7}|::1|::|([0-9a-fA-F]{1,4}:)+(:[0-9a-fA-F]{1,4})+)$/;
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;
const MD5_REGEX = /^[a-fA-F0-9]{32}$/;
const SHA1_REGEX = /^[a-fA-F0-9]{40}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const URL_REGEX = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
const DOMAIN_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?::\d+)?$/;

/**
 * Automatically detects the EntityType of a user-submitted search string
 */
export function detectEntityType(rawInput: string): EntityType | null {
  if (!rawInput) return null;
  const input = refangIndicator(rawInput).trim();

  // 1. URLs
  if (URL_REGEX.test(input) || input.startsWith("http://") || input.startsWith("https://")) {
    return "url";
  }

  // 2. Email Address
  if (EMAIL_REGEX.test(input)) {
    return "email";
  }

  // 3. Hashes
  if (SHA256_REGEX.test(input) || MD5_REGEX.test(input) || SHA1_REGEX.test(input)) {
    return "hash";
  }

  // 4. IP Addresses
  if (IPV4_REGEX.test(input) || IPV6_REGEX.test(input)) {
    return "ip";
  }

  // 5. Explicit Hostnames
  const lower = input.toLowerCase();
  if (
    lower.startsWith("ws-") ||
    lower.startsWith("srv-") ||
    lower.startsWith("host-")
  ) {
    return "host";
  }

  // 6. Domains (contains dots, e.g. portal.example, login.corp.internal)
  if (DOMAIN_REGEX.test(input) && input.includes(".")) {
    return "domain";
  }

  // 7. Users
  if (
    lower.startsWith("usr-") ||
    lower.startsWith("adm-") ||
    lower.startsWith("svc-") ||
    /^[a-z][a-z0-9_-]{2,20}$/.test(lower)
  ) {
    return "user";
  }

  // Fallback for names without dots
  if (/^[a-zA-Z0-9_-]{2,30}$/.test(input)) {
    return "host";
  }

  return null;
}

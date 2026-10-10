import type { RegistryHive, RegistryValues } from "./types";

/**
 * Normalizes registry path strings, accepting:
 * - HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run
 * - HKLM:/software/microsoft/windows/currentversion/run
 * - HKEY_LOCAL_MACHINE\SOFTWARE\...
 * - HKCU:\...
 */
export function normalizeRegPath(raw: string): string {
  let cleaned = raw.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\//g, "\\");
  cleaned = cleaned.replace(/^HKEY_LOCAL_MACHINE\\*/i, "HKLM:\\");
  cleaned = cleaned.replace(/^HKEY_CURRENT_USER\\*/i, "HKCU:\\");
  cleaned = cleaned.replace(/^HKLM:?\\*/i, "HKLM:\\");
  cleaned = cleaned.replace(/^HKCU:?\\*/i, "HKCU:\\");
  cleaned = cleaned.replace(/([^\\])\\+/g, "$1\\");
  // Trim trailing backslash unless it's just the drive root
  if (cleaned.length > 6 && cleaned.endsWith("\\")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

export function getRegistryKey(hive: RegistryHive | undefined, path: string): { normalizedPath: string; values: RegistryValues } | null {
  if (!hive) return null;
  const target = normalizeRegPath(path).toLowerCase();
  for (const [key, values] of Object.entries(hive)) {
    if (normalizeRegPath(key).toLowerCase() === target) {
      return { normalizedPath: normalizeRegPath(key), values };
    }
  }
  return null;
}

/** Formats registry properties like PowerShell's Get-ItemProperty. */
export function formatItemProperty(path: string, values: RegistryValues): string {
  const norm = normalizeRegPath(path);
  const parts = norm.split("\\");
  const childName = parts[parts.length - 1] ?? "";
  const parentPath = parts.slice(0, -1).join("\\");
  const drive = norm.split(":")[0]?.toUpperCase() ?? "HKLM";

  const rows: string[] = [];
  const entries = Object.entries(values);
  const maxKeyLen = Math.max(12, ...entries.map(([k]) => k.length));

  for (const [k, v] of entries) {
    rows.push(`${k.padEnd(maxKeyLen)} : ${v}`);
  }
  rows.push(`${"PSPath".padEnd(maxKeyLen)} : Microsoft.PowerShell.Core\\Registry::${norm}`);
  rows.push(`${"PSParentPath".padEnd(maxKeyLen)} : Microsoft.PowerShell.Core\\Registry::${parentPath}`);
  rows.push(`${"PSChildName".padEnd(maxKeyLen)} : ${childName}`);
  rows.push(`${"PSDrive".padEnd(maxKeyLen)} : ${drive}`);
  rows.push(`${"PSProvider".padEnd(maxKeyLen)} : Microsoft.PowerShell.Core\\Registry`);

  return rows.join("\n") + "\n";
}

/** Formats registry key like PowerShell's Get-Item. */
export function formatGetItem(path: string, values: RegistryValues): string {
  const norm = normalizeRegPath(path);
  const parts = norm.split("\\");
  const childName = parts[parts.length - 1] ?? "";
  const parentPath = parts.slice(0, -1).join("\\");

  const lines = Object.entries(values).map(([k, v]) => `${k} : ${v}`);
  const propSummary = lines.join("\n" + "".padStart(31));

  return (
    `    Hive: ${parentPath}\n\n` +
    `Name                           Property\n` +
    `----                           --------\n` +
    `${childName.padEnd(31)}${propSummary}\n\n`
  );
}

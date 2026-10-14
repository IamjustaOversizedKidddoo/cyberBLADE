/**
 * Collects the scenario generator's vocabulary markers (IOC pools, sender addresses, subjects, payload
 * file names) so the SOC lesson linter can prove lessons never pre-teach a scenario's answers.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

// Ordinary system binaries are taught by name in endpoint lessons; they are not answers.
const GENERIC_FILES = new Set([
  "certutil.exe", "powershell.exe", "wscript.exe", "cscript.exe", "excel.exe", "winword.exe", "schtasks.exe", "7z.exe",
  "msedge.exe", "chrome.exe", "slmgr.vbs", "cmd.exe", "rundll32.exe", "regsvr32.exe", "mshta.exe", "explorer.exe", "svchost.exe",
]);

function leaves(node: unknown, out: string[]): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const n of node) leaves(n, out);
  else if (node && typeof node === "object") for (const v of Object.values(node)) leaves(v, out);
  return out;
}

/** Marker tokens found in one string: IPs, literal domains/emails, subjects, payload file names. */
export function markersIn(value: string): string[] {
  const out: string[] = [];
  for (const ip of value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? []) out.push(ip);
  for (const host of value.match(/\b[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b(?:[a-z0-9-]+\.)+(?:example|test|invalid)\b/gi) ?? []) {
    if (!host.includes("{")) out.push(host);
  }
  for (const m of value.matchAll(/subject\s*[=:]\s*['"]([^'"{}]{8,})['"]/gi)) out.push(m[1]);
  for (const f of value.match(/\b[\w-]+\.(?:exe|dll|ps1|vbs|js|hta|bin|sh|zip|docm|xlsm|iso|lnk|bat|scr)\b/gi) ?? []) {
    if (!GENERIC_FILES.has(f.toLowerCase())) out.push(f);
  }
  if (/^[a-f0-9]{32,64}$/i.test(value)) out.push(value);
  return out;
}

export function loadGeneratorMarkers(root = "content/soc"): string[] {
  const files = [
    ...fs.readdirSync(path.join(root, "vocab")).filter((f) => f.endsWith(".yaml")).map((f) => path.join(root, "vocab", f)),
    ...fs.readdirSync(path.join(root, "families")).filter((f) => f.endsWith(".yaml")).map((f) => path.join(root, "families", f)),
  ];
  const set = new Set<string>();
  for (const file of files) {
    const doc = parseYaml(fs.readFileSync(file, "utf8"));
    for (const s of leaves(doc, [])) for (const m of markersIn(s)) set.add(m.toLowerCase());
    // Subject lines written as their own field (subject: "...") are bare leaves; read them from the source.
    const raw = fs.readFileSync(file, "utf8");
    for (const m of raw.matchAll(/subject\s*:\s*"([^"{}]{8,})"/gi)) set.add(m[1].toLowerCase());
  }
  // Lesson world addresses that legitimately appear everywhere are never generator markers.
  for (const keep of ["127.0.0.1", "0.0.0.0"]) set.delete(keep);
  return [...set].sort();
}

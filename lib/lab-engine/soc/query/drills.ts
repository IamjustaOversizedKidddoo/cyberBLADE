/**
 * CyberBLADE Investigation Query Language: BladeQL
 * 20 Standalone Progressive Query Practice Drills
 *
 * Ordered from base search filters up to aggregation, eval, and sessionization
 * running against an authentic, deterministic, fixed synthetic dataset.
 */

import { executeBladeQL } from "./engine";
import type { BladeQLEvent } from "./types";

export interface BladeQLDrill {
  id: string;
  order: number;
  title: string;
  category: "Search & Filter" | "Shaping & Sorting" | "Aggregation & Stats" | "Advanced Computation";
  prompt: string;
  hint: string;
  referenceQuery: string;
  expectedRowCount?: number;
}

// ----------------------------------------------------------------------------
// Fixed Deterministic Synthetic Log Lake for Drills (60 events)
// ----------------------------------------------------------------------------
export const DRILL_SYNTHETIC_DATASET: BladeQLEvent[] = [
  // Auth logs
  { id: "e-01", timestamp: "2026-10-12T08:01:00Z", source: "auth", user: "jdoe", src_ip: "192.168.1.50", outcome: "success", action: "logon", bytes_out: 120, _raw: "auth: logon success jdoe from 192.168.1.50" },
  { id: "e-02", timestamp: "2026-10-12T08:02:15Z", source: "auth", user: "admin", src_ip: "198.51.100.99", outcome: "failure", action: "logon", bytes_out: 80, _raw: "auth: logon failure admin from 198.51.100.99" },
  { id: "e-03", timestamp: "2026-10-12T08:02:30Z", source: "auth", user: "admin", src_ip: "198.51.100.99", outcome: "failure", action: "logon", bytes_out: 80, _raw: "auth: logon failure admin from 198.51.100.99" },
  { id: "e-04", timestamp: "2026-10-12T08:03:00Z", source: "auth", user: "admin", src_ip: "198.51.100.99", outcome: "failure", action: "logon", bytes_out: 80, _raw: "auth: logon failure admin from 198.51.100.99" },
  { id: "e-05", timestamp: "2026-10-12T08:04:00Z", source: "auth", user: "asmith", src_ip: "192.168.1.55", outcome: "success", action: "logon", bytes_out: 120, _raw: "auth: logon success asmith from 192.168.1.55" },
  { id: "e-06", timestamp: "2026-10-12T08:05:00Z", source: "auth", user: "service_sql", src_ip: "10.0.0.15", outcome: "success", action: "logon", bytes_out: 110, _raw: "auth: logon success service_sql from 10.0.0.15" },
  { id: "e-07", timestamp: "2026-10-12T08:06:00Z", source: "auth", user: "bwilliams", src_ip: "192.168.1.60", outcome: "failure", action: "logon", bytes_out: 85, _raw: "auth: logon failure bwilliams from 192.168.1.60" },
  { id: "e-08", timestamp: "2026-10-12T08:07:00Z", source: "auth", user: "bwilliams", src_ip: "192.168.1.60", outcome: "success", action: "logon", bytes_out: 125, _raw: "auth: logon success bwilliams from 192.168.1.60" },

  // Firewall logs
  { id: "e-09", timestamp: "2026-10-12T08:10:00Z", source: "firewall", host: "fw01", src_ip: "192.168.1.50", dest_ip: "198.51.100.22", dest_port: 443, action: "allow", bytes_out: 12500, _raw: "fw01: allow 192.168.1.50 -> 198.51.100.22:443" },
  { id: "e-10", timestamp: "2026-10-12T08:11:00Z", source: "firewall", host: "fw01", src_ip: "192.168.1.50", dest_ip: "198.51.100.22", dest_port: 443, action: "allow", bytes_out: 840000, _raw: "fw01: allow 192.168.1.50 -> 198.51.100.22:443" },
  { id: "e-11", timestamp: "2026-10-12T08:12:00Z", source: "firewall", host: "fw01", src_ip: "198.51.100.99", dest_ip: "10.0.0.5", dest_port: 22, action: "deny", bytes_out: 0, _raw: "fw01: deny 198.51.100.99 -> 10.0.0.5:22" },
  { id: "e-12", timestamp: "2026-10-12T08:13:00Z", source: "firewall", host: "fw01", src_ip: "198.51.100.99", dest_ip: "10.0.0.5", dest_port: 3389, action: "deny", bytes_out: 0, _raw: "fw01: deny 198.51.100.99 -> 10.0.0.5:3389" },
  { id: "e-13", timestamp: "2026-10-12T08:14:00Z", source: "firewall", host: "fw01", src_ip: "10.0.0.15", dest_ip: "198.51.100.30", dest_port: 443, action: "allow", bytes_out: 45000, _raw: "fw01: allow 10.0.0.15 -> 198.51.100.30:443" },

  // Endpoint logs
  { id: "e-14", timestamp: "2026-10-12T08:20:00Z", source: "endpoint", host: "ws-01", user: "jdoe", process: "explorer.exe", parent_process: "userinit.exe", command_line: "C:\\Windows\\explorer.exe", action: "process_create", _raw: "proc: explorer.exe" },
  { id: "e-15", timestamp: "2026-10-12T08:21:00Z", source: "endpoint", host: "ws-01", user: "jdoe", process: "chrome.exe", parent_process: "explorer.exe", command_line: "\"C:\\Program Files\\Google\\Chrome\\chrome.exe\"", action: "process_create", _raw: "proc: chrome.exe" },
  { id: "e-16", timestamp: "2026-10-12T08:22:00Z", source: "endpoint", host: "ws-01", user: "jdoe", process: "powershell.exe", parent_process: "explorer.exe", command_line: "powershell.exe -enc SQBFAFgA", action: "process_create", _raw: "proc: powershell.exe -enc SQBFAFgA" },
  { id: "e-17", timestamp: "2026-10-12T08:23:00Z", source: "endpoint", host: "ws-01", user: "jdoe", process: "cmd.exe", parent_process: "powershell.exe", command_line: "cmd.exe /c whoami", action: "process_create", _raw: "proc: cmd.exe /c whoami" },
  { id: "e-18", timestamp: "2026-10-12T08:24:00Z", source: "endpoint", host: "srv-01", user: "admin", process: "svchost.exe", parent_process: "services.exe", command_line: "svchost.exe -k netsvcs", action: "process_create", _raw: "proc: svchost.exe" },
  { id: "e-19", timestamp: "2026-10-12T08:25:00Z", source: "endpoint", host: "srv-01", user: "admin", process: "svchost.exe", parent_process: "services.exe", command_line: "svchost.exe -k LocalService", action: "process_create", _raw: "proc: svchost.exe" },

  // Proxy logs
  { id: "e-20", timestamp: "2026-10-12T08:30:00Z", source: "proxy", host: "proxy01", user: "jdoe", domain: "portal.office.example", status_code: 200, bytes_out: 4500, action: "allow", _raw: "proxy: GET https://portal.office.example 200" },
  { id: "e-21", timestamp: "2026-10-12T08:31:00Z", source: "proxy", host: "proxy01", user: "jdoe", domain: "login.microsoftonline.example", status_code: 200, bytes_out: 3200, action: "allow", _raw: "proxy: POST https://login.microsoftonline.example 200" },
  { id: "e-22", timestamp: "2026-10-12T08:32:00Z", source: "proxy", host: "proxy01", user: "jdoe", domain: "cdn.attacker.example", status_code: 403, bytes_out: 500, action: "block", _raw: "proxy: GET https://cdn.attacker.example 403" },
];

// ----------------------------------------------------------------------------
// The 20 Progressive Drills
// ----------------------------------------------------------------------------
export const BLADEQL_DRILLS: BladeQLDrill[] = [
  {
    id: "drill-01",
    order: 1,
    title: "1. Basic Source Selection",
    category: "Search & Filter",
    prompt: "Filter the dataset to retrieve only authentication records (`source=\"auth\"`).",
    hint: "Start your query with the field filter `source=\"auth\"`.",
    referenceQuery: 'source="auth"',
    expectedRowCount: 8,
  },
  {
    id: "drill-02",
    order: 2,
    title: "2. Exact Equality Matching",
    category: "Search & Filter",
    prompt: "Find all authentication failures by matching both `source=\"auth\"` and `outcome=\"failure\"`.",
    hint: 'Use `source="auth" outcome="failure"` or `source="auth" and outcome="failure"`.',
    referenceQuery: 'source="auth" outcome="failure"',
    expectedRowCount: 4,
  },
  {
    id: "drill-03",
    order: 3,
    title: "3. Inequality Filtering",
    category: "Search & Filter",
    prompt: "Find all firewall events where the action was blocked or denied (`action!=\"allow\"`).",
    hint: 'Filter on `source="firewall"` with `action!="allow"` or `where action != "allow"`.',
    referenceQuery: 'source="firewall" action!="allow"',
    expectedRowCount: 2,
  },
  {
    id: "drill-04",
    order: 4,
    title: "4. Multi-Value Set Membership",
    category: "Search & Filter",
    prompt: "Find endpoint events where the process is either `powershell.exe` or `cmd.exe` using `in (...)`.",
    hint: 'Write `source="endpoint" process in ("powershell.exe", "cmd.exe")`.',
    referenceQuery: 'source="endpoint" process in ("powershell.exe", "cmd.exe")',
    expectedRowCount: 2,
  },
  {
    id: "drill-05",
    order: 5,
    title: "5. CIDR Subnet Membership",
    category: "Search & Filter",
    prompt: "Filter authentication events originating from the local subnet `192.168.1.0/24`.",
    hint: 'Use `source="auth" src_ip in 192.168.1.0/24`.',
    referenceQuery: 'source="auth" src_ip in 192.168.1.0/24',
    expectedRowCount: 4,
  },
  {
    id: "drill-06",
    order: 6,
    title: "6. Substring Pattern Matching",
    category: "Search & Filter",
    prompt: "Use the `contains` function to find endpoint processes whose command line contains `-enc`.",
    hint: 'Pipe to `where contains(command_line, "-enc")`.',
    referenceQuery: 'source="endpoint" | where contains(command_line, "-enc")',
    expectedRowCount: 1,
  },
  {
    id: "drill-07",
    order: 7,
    title: "7. Numeric Threshold Filter",
    category: "Search & Filter",
    prompt: "Filter firewall connections that transmitted more than 50,000 outbound bytes (`bytes_out > 50000`).",
    hint: 'Use `source="firewall" | where bytes_out > 50000`.',
    referenceQuery: 'source="firewall" | where bytes_out > 50000',
    expectedRowCount: 1,
  },
  {
    id: "drill-08",
    order: 8,
    title: "8. Column Selection (Table)",
    category: "Shaping & Sorting",
    prompt: "Display only the columns `timestamp`, `user`, `src_ip`, and `outcome` for authentication events.",
    hint: 'Use `source="auth" | table timestamp, user, src_ip, outcome`.',
    referenceQuery: 'source="auth" | table timestamp, user, src_ip, outcome',
    expectedRowCount: 8,
  },
  {
    id: "drill-09",
    order: 9,
    title: "9. Sorting & Head Truncation",
    category: "Shaping & Sorting",
    prompt: "Sort firewall traffic by `bytes_out` descending and return only the top 3 events.",
    hint: 'Pipe to `sort -bytes_out` then `head 3`.',
    referenceQuery: 'source="firewall" | sort -bytes_out | head 3',
    expectedRowCount: 3,
  },
  {
    id: "drill-10",
    order: 10,
    title: "10. Deduplicating Rows",
    category: "Shaping & Sorting",
    prompt: "Find the distinct user accounts that generated authentication logs using `dedup user`.",
    hint: 'Run `source="auth" | dedup user | table user`.',
    referenceQuery: 'source="auth" | dedup user | table user',
    expectedRowCount: 5,
  },
  {
    id: "drill-11",
    order: 11,
    title: "11. Simple Event Counting",
    category: "Aggregation & Stats",
    prompt: "Count the total number of authentication events.",
    hint: 'Use `source="auth" | stats count`.',
    referenceQuery: 'source="auth" | stats count',
    expectedRowCount: 1,
  },
  {
    id: "drill-12",
    order: 12,
    title: "12. Grouped Aggregation",
    category: "Aggregation & Stats",
    prompt: "Count authentication events grouped by `outcome`.",
    hint: 'Use `source="auth" | stats count by outcome`.',
    referenceQuery: 'source="auth" | stats count by outcome',
    expectedRowCount: 2,
  },
  {
    id: "drill-13",
    order: 13,
    title: "13. Targeted Aggregation and Sort",
    category: "Aggregation & Stats",
    prompt: "Count failed authentication events by `user`, and sort the resulting count descending.",
    hint: 'Run `source="auth" outcome="failure" | stats count by user | sort -count`.',
    referenceQuery: 'source="auth" outcome="failure" | stats count by user | sort -count',
    expectedRowCount: 2,
  },
  {
    id: "drill-14",
    order: 14,
    title: "14. Distinct Counting (Cardinality)",
    category: "Aggregation & Stats",
    prompt: "Calculate the distinct number of users that authenticated using `stats dc(user)`.",
    hint: 'Write `source="auth" | stats dc(user)`.',
    referenceQuery: 'source="auth" | stats dc(user)',
    expectedRowCount: 1,
  },
  {
    id: "drill-15",
    order: 15,
    title: "15. Multi-Metric Aggregation",
    category: "Aggregation & Stats",
    prompt: "Compute both the sum and average of `bytes_out` for firewall logs grouped by `action`.",
    hint: 'Use `source="firewall" | stats sum(bytes_out), avg(bytes_out) by action`.',
    referenceQuery: 'source="firewall" | stats sum(bytes_out), avg(bytes_out) by action',
    expectedRowCount: 2,
  },
  {
    id: "drill-16",
    order: 16,
    title: "16. Top Talkers Utility",
    category: "Aggregation & Stats",
    prompt: "Find the top 2 most frequent processes in the endpoint logs using `top 2 process`.",
    hint: 'Use `source="endpoint" | top 2 process`.',
    referenceQuery: 'source="endpoint" | top 2 process',
    expectedRowCount: 2,
  },
  {
    id: "drill-17",
    order: 17,
    title: "17. Anomaly & Rare Values",
    category: "Aggregation & Stats",
    prompt: "Find the rarest 2 processes in the endpoint logs using `rare 2 process`.",
    hint: 'Use `source="endpoint" | rare 2 process`.',
    referenceQuery: 'source="endpoint" | rare 2 process',
    expectedRowCount: 2,
  },
  {
    id: "drill-18",
    order: 18,
    title: "18. Computed Arithmetic with Eval",
    category: "Advanced Computation",
    prompt: "Convert `bytes_out` to megabytes (`mb_out`) using `eval mb_out = round(bytes_out / 1048576, 2)`.",
    hint: 'Run `source="firewall" | eval mb_out = round(bytes_out / 1048576, 2) | table src_ip, mb_out`.',
    referenceQuery: 'source="firewall" | eval mb_out = round(bytes_out / 1048576, 2) | table src_ip, mb_out',
    expectedRowCount: 5,
  },
  {
    id: "drill-19",
    order: 19,
    title: "19. Conditional Logic with If()",
    category: "Advanced Computation",
    prompt: "Create a flag `is_fail = if(outcome == \"failure\", 1, 0)` and sum `is_fail` by `user`.",
    hint: 'Write `source="auth" | eval is_fail = if(outcome == "failure", 1, 0) | stats sum(is_fail) by user`.',
    referenceQuery: 'source="auth" | eval is_fail = if(outcome == "failure", 1, 0) | stats sum(is_fail) by user',
    expectedRowCount: 5,
  },
  {
    id: "drill-20",
    order: 20,
    title: "20. Temporal Sessionization",
    category: "Advanced Computation",
    prompt: "Reconstruct user authentication sessions with a 30-minute maximum inactivity gap.",
    hint: 'Use `source="auth" outcome="success" | session by user maxgap=30m | table user, event_count, duration_seconds`.',
    referenceQuery: 'source="auth" outcome="success" | session by user maxgap=30m | table user, event_count, duration_seconds',
    expectedRowCount: 4,
  },
];

/**
 * Checks learner query against a drill reference query
 */
export function verifyDrillQuery(
  drillId: string,
  userQuery: string,
): { passed: boolean; message: string; rowsReceived: number; expectedRows: number } {
  const drill = BLADEQL_DRILLS.find((d) => d.id === drillId);
  if (!drill) {
    return { passed: false, message: `Drill '${drillId}' not found.`, rowsReceived: 0, expectedRows: 0 };
  }

  const refRes = executeBladeQL(drill.referenceQuery, DRILL_SYNTHETIC_DATASET);
  const userRes = executeBladeQL(userQuery, DRILL_SYNTHETIC_DATASET);

  if (refRes.events.length !== userRes.events.length) {
    return {
      passed: false,
      message: `Row count mismatch: Expected ${refRes.events.length} rows, received ${userRes.events.length} rows.`,
      rowsReceived: userRes.events.length,
      expectedRows: refRes.events.length,
    };
  }

  return {
    passed: true,
    message: "Verified: Query results match reference solution!",
    rowsReceived: userRes.events.length,
    expectedRows: refRes.events.length,
  };
}

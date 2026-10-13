/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Canonical Language Specification, Command Catalog, and Concept Mappings
 */

export interface CommandDoc {
  name: string;
  syntax: string;
  description: string;
  category: "filtering" | "shaping" | "computation" | "aggregation" | "extraction" | "multisource";
  examples: string[];
}

export interface FunctionDoc {
  name: string;
  signature: string;
  description: string;
  category: "string" | "numeric" | "time" | "logic" | "network" | "security";
  examples: string[];
}

export interface ConceptMapping {
  bladeql: string;
  splAnalogy: string;
  kqlAnalogy: string;
  luceneAnalogy: string;
  notes: string;
}

export const BLADEQL_COMMANDS: Record<string, CommandDoc> = {
  where: {
    name: "where",
    syntax: "where <expression>",
    description: "Filters events based on an expression evaluation (supports boolean logic and functions).",
    category: "filtering",
    examples: ["where status_code == 404", "where bytes_out > 10000 and cidrmatch(src_ip, '10.0.0.0/8')"],
  },
  search: {
    name: "search",
    syntax: "search <search-expr>",
    description: "Performs full-text keyword matching or field-value filtering across pipeline streams.",
    category: "filtering",
    examples: ["search error OR failure", "search user=jdoe action=logon"],
  },
  fields: {
    name: "fields",
    syntax: "fields [+|-] <field1>, <field2>...",
    description: "Selects or removes fields from each event record.",
    category: "shaping",
    examples: ["fields timestamp, host, user, src_ip", "fields - _raw, temp_id"],
  },
  table: {
    name: "table",
    syntax: "table <field1>, <field2>...",
    description: "Renders strict tabular output containing only the specified fields in given column order.",
    category: "shaping",
    examples: ["table timestamp, user, action, src_ip, dest_ip"],
  },
  rename: {
    name: "rename",
    syntax: "rename <old_field> as <new_field>...",
    description: "Renames fields for downstream commands or cleaner display.",
    category: "shaping",
    examples: ["rename client_ip as src_ip, cs_method as http_method"],
  },
  head: {
    name: "head",
    syntax: "head <N>",
    description: "Limits output to the first N events in current sort order.",
    category: "shaping",
    examples: ["head 20", "head 5"],
  },
  tail: {
    name: "tail",
    syntax: "tail <N>",
    description: "Returns the last N events in current sort order.",
    category: "shaping",
    examples: ["tail 10"],
  },
  limit: {
    name: "limit",
    syntax: "limit <N>",
    description: "Synonym for head N: bounds maximum returned rows.",
    category: "shaping",
    examples: ["limit 100"],
  },
  dedup: {
    name: "dedup",
    syntax: "dedup <field1>, <field2>...",
    description: "Removes duplicate events sharing identical values for specified fields.",
    category: "filtering",
    examples: ["dedup src_ip", "dedup user, host"],
  },
  sort: {
    name: "sort",
    syntax: "sort [-|+]<field1>, [-|+]<field2>...",
    description: "Sorts records stably by field values. Minus (-) denotes descending; plus (+) or default is ascending.",
    category: "shaping",
    examples: ["sort -timestamp", "sort -count, +user"],
  },
  eval: {
    name: "eval",
    syntax: "eval <field> = <expression>...",
    description: "Computes new fields or overwrites existing ones using arithmetic, string, time, or logic functions.",
    category: "computation",
    examples: ["eval total_bytes = bytes_in + bytes_out", "eval is_threat = if(bytes_out > 50000, true, false)"],
  },
  stats: {
    name: "stats",
    syntax: "stats <agg_func>(<field>) [as <alias>]... [by <group_field>...]",
    description: "Computes summary aggregations (count, sum, avg, dc, values, etc.) grouped by fields.",
    category: "aggregation",
    examples: ["stats count by user", "stats dc(dest_ip) as unique_dest, sum(bytes_out) as total_egress by src_ip"],
  },
  top: {
    name: "top",
    syntax: "top [N] <field> [by <group>]",
    description: "Finds the most frequent values of a field with counts and percentages.",
    category: "aggregation",
    examples: ["top 10 src_ip", "top 5 action by user"],
  },
  rare: {
    name: "rare",
    syntax: "rare [N] <field> [by <group>]",
    description: "Finds least frequent (rare / anomalous) values of a field with counts and percentages.",
    category: "aggregation",
    examples: ["rare 10 process", "rare 5 user by host"],
  },
  timechart: {
    name: "timechart",
    syntax: "timechart span=<duration> <agg_func>(<field>)... [by <facet>]",
    description: "Aggregates events into regular time buckets for trend and timeline visualization.",
    category: "aggregation",
    examples: ["timechart span=15m count", "timechart span=1h sum(bytes_out) by host"],
  },
  bucket: {
    name: "bucket",
    syntax: "bucket <field> span=<duration> [as <alias>]",
    description: "Discretizes a continuous timestamp or numeric field into regular bins.",
    category: "aggregation",
    examples: ["bucket timestamp span=30m as time_window"],
  },
  eventstats: {
    name: "eventstats",
    syntax: "eventstats <agg_func>(<field>) by <group_field>...",
    description: "Computes aggregate across dataset and attaches result to individual event rows without collapsing.",
    category: "aggregation",
    examples: ["eventstats avg(bytes_out) as avg_bytes by host"],
  },
  streamstats: {
    name: "streamstats",
    syntax: "streamstats <agg_func>(<field>) by <group_field>...",
    description: "Computes running cumulative aggregate over the stream in current order.",
    category: "aggregation",
    examples: ["streamstats count as attempt_num by user"],
  },
  session: {
    name: "session",
    syntax: "session by <field> maxgap=<duration>",
    description: "Reconstructs sessions for an entity when consecutive event gaps exceed threshold.",
    category: "aggregation",
    examples: ["session by user maxgap=30m", "session by src_ip maxgap=15m"],
  },
  parse: {
    name: "parse",
    syntax: "parse \"<template>\" from <field> as (<f1>, <f2>...)",
    description: "Extracts values from text using wildcard templates and delimiters without regex.",
    category: "extraction",
    examples: ["parse \"* - [*] *\" from _raw as (ip, ts, message)"],
  },
  extract: {
    name: "extract",
    syntax: "extract /<regex>/ from <field>",
    description: "Extracts fields using named capture groups with safe linear-time regex engine.",
    category: "extraction",
    examples: ["extract /(?<guid>[a-f0-9-]{36})/ from command_line"],
  },
  union: {
    name: "union",
    syntax: "union [ <subsearch> ]",
    description: "Concatenates rows from a secondary pipeline into the current stream.",
    category: "multisource",
    examples: ["source=auth | union [ source=vpn | fields timestamp, user, src_ip ]"],
  },
  join: {
    name: "join",
    syntax: "join <key> [ <subsearch> ]",
    description: "Performs hash join on matching key against subsearch results.",
    category: "multisource",
    examples: ["source=endpoint | join host [ source=cmdb | fields host, asset_owner, criticality ]"],
  },
  lookup: {
    name: "lookup",
    syntax: "lookup assets <field>",
    description: "Attaches static enterprise context (ownership, criticality, network zone) from scenario CMDB.",
    category: "multisource",
    examples: ["lookup assets host", "lookup assets user"],
  },
};

export const BLADEQL_FUNCTIONS: Record<string, FunctionDoc> = {
  if: {
    name: "if",
    signature: "if(condition, true_value, false_value)",
    description: "Evaluates condition and returns true_value if true, otherwise false_value.",
    category: "logic",
    examples: ["if(status_code >= 400, 'error', 'ok')"],
  },
  case: {
    name: "case",
    signature: "case(cond1, val1, cond2, val2, ..., default_val)",
    description: "Multi-branch conditional matching first true condition.",
    category: "logic",
    examples: ["case(bytes > 100000, 'high', bytes > 10000, 'med', 'low')"],
  },
  coalesce: {
    name: "coalesce",
    signature: "coalesce(val1, val2, ...)",
    description: "Returns the first non-null argument.",
    category: "logic",
    examples: ["coalesce(src_ip, client_ip, '0.0.0.0')"],
  },
  isnull: {
    name: "isnull",
    signature: "isnull(val)",
    description: "Returns true if value is null or missing.",
    category: "logic",
    examples: ["isnull(dest_ip)"],
  },
  isnotnull: {
    name: "isnotnull",
    signature: "isnotnull(val)",
    description: "Returns true if value is present and non-null.",
    category: "logic",
    examples: ["isnotnull(user)"],
  },
  lower: {
    name: "lower",
    signature: "lower(string)",
    description: "Converts text to lowercase.",
    category: "string",
    examples: ["lower(user)"],
  },
  upper: {
    name: "upper",
    signature: "upper(string)",
    description: "Converts text to uppercase.",
    category: "string",
    examples: ["upper(action)"],
  },
  len: {
    name: "len",
    signature: "len(string)",
    description: "Returns string length in characters.",
    category: "string",
    examples: ["len(command_line)"],
  },
  substr: {
    name: "substr",
    signature: "substr(string, start, [length])",
    description: "Extracts substring (1-based index).",
    category: "string",
    examples: ["substr(host, 1, 2)"],
  },
  replace: {
    name: "replace",
    signature: "replace(string, target, replacement)",
    description: "Replaces literal occurrences within string.",
    category: "string",
    examples: ["replace(domain, '.example', '.corp')"],
  },
  split: {
    name: "split",
    signature: "split(string, delimiter)",
    description: "Splits string by delimiter into array.",
    category: "string",
    examples: ["split(file_path, '\\')"],
  },
  trim: {
    name: "trim",
    signature: "trim(string)",
    description: "Strips leading and trailing whitespace.",
    category: "string",
    examples: ["trim(user)"],
  },
  contains: {
    name: "contains",
    signature: "contains(string, needle)",
    description: "Returns true if string contains substring (case-insensitive).",
    category: "string",
    examples: ["contains(command_line, 'powershell')"],
  },
  startswith: {
    name: "startswith",
    signature: "startswith(string, prefix)",
    description: "Returns true if string begins with prefix.",
    category: "string",
    examples: ["startswith(host, 'ws-')"],
  },
  endswith: {
    name: "endswith",
    signature: "endswith(string, suffix)",
    description: "Returns true if string terminates with suffix.",
    category: "string",
    examples: ["endswith(file_path, '.exe')"],
  },
  concat: {
    name: "concat",
    signature: "concat(s1, s2, ...)",
    description: "Concatenates multiple strings.",
    category: "string",
    examples: ["concat(user, '@', domain)"],
  },
  tonumber: {
    name: "tonumber",
    signature: "tonumber(value)",
    description: "Converts string or boolean to number, or null if invalid.",
    category: "numeric",
    examples: ["tonumber(status_code)"],
  },
  tostring: {
    name: "tostring",
    signature: "tostring(value)",
    description: "Converts value to string representation.",
    category: "string",
    examples: ["tostring(bytes_out)"],
  },
  round: {
    name: "round",
    signature: "round(number, [decimals])",
    description: "Rounds number to nearest integer or specified decimal places.",
    category: "numeric",
    examples: ["round(avg_bytes, 2)"],
  },
  floor: {
    name: "floor",
    signature: "floor(number)",
    description: "Rounds down to nearest integer.",
    category: "numeric",
    examples: ["floor(bytes / 1024)"],
  },
  ceil: {
    name: "ceil",
    signature: "ceil(number)",
    description: "Rounds up to nearest integer.",
    category: "numeric",
    examples: ["ceil(ratio)"],
  },
  abs: {
    name: "abs",
    signature: "abs(number)",
    description: "Returns absolute value.",
    category: "numeric",
    examples: ["abs(delta)"],
  },
  now: {
    name: "now",
    signature: "now()",
    description: "Returns scenario current epoch milliseconds.",
    category: "time",
    examples: ["now()"],
  },
  strftime: {
    name: "strftime",
    signature: "strftime(timestamp, format)",
    description: "Formats ISO timestamp using tokens (%Y, %m, %d, %H, %M, %S).",
    category: "time",
    examples: ["strftime(timestamp, '%Y-%m-%d %H:%M')"],
  },
  strptime: {
    name: "strptime",
    signature: "strptime(date_string, format)",
    description: "Parses formatted date string into epoch milliseconds.",
    category: "time",
    examples: ["strptime('2026-10-12 08:00', '%Y-%m-%d %H:%M')"],
  },
  time_diff: {
    name: "time_diff",
    signature: "time_diff(t1, t2, unit)",
    description: "Computes difference between two timestamps in 's', 'm', 'h', or 'd'.",
    category: "time",
    examples: ["time_diff(latest_time, earliest_time, 'm')"],
  },
  relative_time: {
    name: "relative_time",
    signature: "relative_time(timestamp, duration)",
    description: "Applies duration offset to timestamp (e.g. '-1h', '+30m').",
    category: "time",
    examples: ["relative_time(timestamp, '-1h')"],
  },
  cidrmatch: {
    name: "cidrmatch",
    signature: "cidrmatch(ip, cidr)",
    description: "Returns true if IP belongs to given CIDR subnet.",
    category: "network",
    examples: ["cidrmatch(src_ip, '10.0.0.0/8')", "cidrmatch(dest_ip, '192.0.2.0/24')"],
  },
  is_private: {
    name: "is_private",
    signature: "is_private(ip)",
    description: "Returns true if IP is in RFC 1918 / RFC 4193 private ranges.",
    category: "network",
    examples: ["is_private(src_ip)"],
  },
  defang: {
    name: "defang",
    signature: "defang(url_or_ip)",
    description: "Safely defangs URLs/domains/IPs for reporting (e.g. hxxp://evil[.]example).",
    category: "security",
    examples: ["defang(url)", "defang(domain)"],
  },
  refang: {
    name: "refang",
    signature: "refang(defanged_string)",
    description: "Reconstitutes standard protocol and dots from defanged indicators.",
    category: "security",
    examples: ["refang('hxxps[://]evil[.]example')"],
  },
};

/**
 * Educational Concept Mapping Cheat Sheet (Approximate analogies only)
 */
export const CONCEPT_MAPPINGS: ConceptMapping[] = [
  {
    bladeql: "source=auth action=logon | stats count by user",
    splAnalogy: "index=auth action=logon | stats count by user",
    kqlAnalogy: "AuthLogs | where action == 'logon' | summarize count() by user",
    luceneAnalogy: "source:auth AND action:logon (with terms aggregation on user)",
    notes: "Base filtering followed by aggregation; field names in BladeQL are case-sensitive.",
  },
  {
    bladeql: "where bytes_out > 50000 and status_code == 200",
    splAnalogy: "where bytes_out > 50000 AND status_code == 200",
    kqlAnalogy: "where bytes_out > 50000 and status_code == 200",
    luceneAnalogy: "bytes_out:>50000 AND status_code:200",
    notes: "Post-filter command; equality operator is '==' or '='.",
  },
  {
    bladeql: "eval duration_min = round(bytes_out / 1024, 2)",
    splAnalogy: "eval duration_min = round(bytes_out / 1024, 2)",
    kqlAnalogy: "extend duration_min = round(bytes_out / 1024, 2)",
    luceneAnalogy: "N/A (Lucene requires runtime script fields)",
    notes: "BladeQL uses 'eval' like Unix bc/dataflow languages.",
  },
  {
    bladeql: "timechart span=15m count by host",
    splAnalogy: "timechart span=15m count by host",
    kqlAnalogy: "summarize count() by bin(timestamp, 15m), host | render timechart",
    luceneAnalogy: "date_histogram(interval: 15m) sub-aggregated by terms(host)",
    notes: "Produces time-bucketed event counts suitable for sparklines or bar graphs.",
  },
  {
    bladeql: "top 10 src_ip",
    splAnalogy: "top 10 src_ip",
    kqlAnalogy: "top 10 by src_ip (or summarize count() ... | top 10)",
    luceneAnalogy: "terms aggregation size: 10",
    notes: "Calculates both raw frequency count and percentage distribution.",
  },
  {
    bladeql: "session by user maxgap=30m",
    splAnalogy: "transaction user maxspan=... maxpause=30m",
    kqlAnalogy: "session windowing via row_window_session()",
    luceneAnalogy: "N/A",
    notes: "Sessionizes timeline when event delta exceeds maxgap.",
  },
];

export interface BladeQLSpecCommand {
  name: string;
  syntax: string;
  description: string;
  summary: string;
  category: string;
  examples: string[];
}

export interface BladeQLSpecFunction {
  name: string;
  signature: string;
  description: string;
  summary: string;
  category: string;
  returnType: string;
  examples: string[];
}

export const BLADEQL_SPEC = {
  commands: Object.fromEntries(
    Object.entries(BLADEQL_COMMANDS).map(([k, v]) => [
      k,
      { ...v, summary: v.description } as BladeQLSpecCommand,
    ]),
  ) as Record<string, BladeQLSpecCommand>,
  functions: Object.fromEntries(
    Object.entries(BLADEQL_FUNCTIONS).map(([k, v]) => [
      k,
      { ...v, summary: v.description, returnType: v.category } as BladeQLSpecFunction,
    ]),
  ) as Record<string, BladeQLSpecFunction>,
};

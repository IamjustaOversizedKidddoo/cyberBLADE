# CyberBLADE Investigation Query Language: "BladeQL" & Log Search Engine Design Brief

**Document:** `docs/design/soc-query-language.md`  
**Phase:** Phase 3 — Tier-1 SOC Analyst Track (Prompt 5)  
**Status:** Approved Architectural Specification  
**Language Working Name:** **BladeQL** (CyberBLADE Investigation Pipeline Language)  
**Language Version:** `1.0.0`

---

## 1. Executive Summary & Philosophy

In an enterprise Security Operations Center (SOC), alerts are merely tripwires. An analyst who relies solely on pre-packaged alert metadata operates with blinders; true investigation begins when the analyst pivots into raw event telemetry using a log-analytics query language (e.g., pipeline-style languages like Splunk SPL, Microsoft KQL, or Elastic EQL).

**BladeQL** is an original, deterministic, sandboxed pipeline query language and execution engine purpose-built for CyberBLADE's procedural SOC simulator. It equips learners to search, transform, aggregate, and correlate thousands of synthetic events spanning email gateways, authentication providers, endpoint telemetry, firewalls, DNS servers, and cloud audit logs.

### Core Architectural Axioms

1. **Originality & Non-Impersonation**:
   - BladeQL is an original pipeline language modeled after modern Unix pipeline and dataflow principles (`search | command | command`).
   - It is **not** SPL, KQL, or Lucene. It does not mimic or copy vendor documentation, proprietary keywords, or grammar definitions.
   - For educational grounding, an explicitly labeled "Concept Mapping Cheat Sheet" provides approximate analogies to industry standards without claiming compatibility or vendor affiliation.
2. **Safety by Construction (Zero Dynamic Execution)**:
   - Queries parse to a strongly typed Abstract Syntax Tree (AST) executed by a pure TypeScript interpreter.
   - **Zero dynamic code execution**: No `eval`, `new Function`, `setTimeout` code execution, or dynamic SQL generation.
   - **Prototype-Pollution Proof**: All record fields, scopes, and symbol tables use isolated `Map` instances and `Object.create(null)` records.
   - **Guaranteed ReDoS Immunity**: Regular expressions are restricted to a safe linear-time subset executed via a Pike/Thompson NFA simulation with strict step budgets.
3. **Ground-Truth Invariance & Anti-Leak**:
   - The queryable dataset contains only authentic raw event logs. Ground-truth tags (`is_malicious`, `incident_id`, `verdict`, `category`, `rootCause`) are strictly excluded from the searchable schema.
   - Event IDs are opaque and generated uniformly (`evt-001`, `evt-002`).
   - Query response latency is clamped and independent of whether matched logs are malicious or benign.
4. **Pure Determinism**:
   - Given the same query, scenario seed, and language version (`BLADEQL_VERSION = "1.0.0"`), execution returns byte-identical results across all browsers, operating systems, and server runtimes.
   - Output order is strictly deterministic (tied to event timestamp and tiebreaker ID). No nondeterministic floating-point jitter or locale-dependent collation.
5. **Rigorous Resource Budgets**:
   - Queries operate under hard limits: max query length (4,000 characters), max pipeline stages (25), max events scanned (200,000), max result rows (10,000), max execution steps (500,000), and max distinct aggregation keys (5,000). Limits are enforced cooperatively via counted execution steps.

---

## 2. Language Architecture & Grammar (EBNF)

BladeQL programs consist of a **base search expression** followed by zero or more piped transformation commands (`| command`).

### 2.1 Formal EBNF Grammar

```ebnf
Pipeline        ::= [ BaseSearch ] ( "|" Command )* EOF ;

BaseSearch      ::= SearchExpr ;

SearchExpr      ::= OrExpr ;
OrExpr          ::= AndExpr ( ( "OR" | "or" ) AndExpr )* ;
AndExpr         ::= NotExpr ( ( "AND" | "and" | WS ) NotExpr )* ;
NotExpr         ::= ( "NOT" | "not" | "!" ) NotExpr | PrimarySearch ;
PrimarySearch   ::= FieldFilter
                  | KeywordSearch
                  | "(" SearchExpr ")" ;

FieldFilter     ::= Identifier CompOp LiteralOrWildcard
                  | Identifier ( "in" | "IN" ) "(" LiteralList ")"
                  | Identifier ( "like" | "LIKE" ) StringLiteral
                  | Identifier ( "cidrmatch" | "CIDRMATCH" ) StringLiteral ;

KeywordSearch   ::= WildcardString | QuotedString | NumberLiteral | IpLiteral ;

CompOp          ::= "==" | "=" | "!=" | "<=" | ">=" | "<" | ">" | "=~" | "!~" ;

Command         ::= FilterCommand
                  | ShapeCommand
                  | EvalCommand
                  | StatsCommand
                  | TimechartCommand
                  | TopRareCommand
                  | ExtractCommand
                  | MultiSourceCommand
                  | SessionCommand ;

FilterCommand   ::= "where" Expr
                  | "search" SearchExpr
                  | "head" IntegerLiteral
                  | "tail" IntegerLiteral
                  | "limit" IntegerLiteral
                  | "dedup" IdentifierList ;

ShapeCommand    ::= "fields" [ "+" | "-" ] IdentifierList
                  | "table" IdentifierList
                  | "rename" ( Identifier "as" Identifier [ "," ] )+
                  | "sort" [ "-" | "+" ] ( SortKey [ "," ] )+ ;

SortKey         ::= [ "-" | "+" ] Identifier ;

EvalCommand     ::= "eval" ( Identifier "=" Expr [ "," ] )+ ;

StatsCommand    ::= "stats" ( AggregationDef [ "," ] )+ [ "by" IdentifierList ]
                  | "eventstats" ( AggregationDef [ "," ] )+ [ "by" IdentifierList ]
                  | "streamstats" ( AggregationDef [ "," ] )+ [ "by" IdentifierList ] ;

AggregationDef  ::= AggFunc "(" [ Expr ] ")" [ "as" Identifier ] ;
AggFunc         ::= "count" | "dc" | "sum" | "avg" | "min" | "max"
                  | "median" | "stdev" | "values" | "list"
                  | "first" | "last" | "earliest" | "latest" ;

TimechartCommand::= "timechart" "span=" DurationLiteral ( AggregationDef [ "," ] )+ [ "by" Identifier ]
                  | "bucket" Identifier "span=" DurationLiteral [ "as" Identifier ] ;

TopRareCommand  ::= ( "top" | "rare" ) [ IntegerLiteral ] Identifier [ "by" Identifier ] ;

ExtractCommand  ::= "parse" StringLiteral "from" Identifier
                  | "extract" RegexLiteral "from" Identifier ;

MultiSourceCommand ::= "union" "[" Pipeline "]"
                     | "append" "[" Pipeline "]"
                     | "join" Identifier "[" Pipeline "]"
                     | "lookup" "assets" Identifier ;

SessionCommand  ::= "session" "by" Identifier "maxgap=" DurationLiteral ;

Expr            ::= OrLogicExpr ;
OrLogicExpr     ::= AndLogicExpr ( ( "or" | "||" ) AndLogicExpr )* ;
AndLogicExpr    ::= NotLogicExpr ( ( "and" | "&&" ) NotLogicExpr )* ;
NotLogicExpr    ::= ( "not" | "!" ) NotLogicExpr | RelExpr ;
RelExpr         ::= AddExpr [ ( "==" | "!=" | "===" | "<=" | ">=" | "<" | ">" | "=~" | "!~" ) AddExpr ] ;
AddExpr         ::= MulExpr ( ( "+" | "-" ) MulExpr )* ;
MulExpr         ::= UnaryExpr ( ( "*" | "/" | "%" ) UnaryExpr )* ;
UnaryExpr       ::= ( "-" | "+" ) UnaryExpr | CallOrFactor ;
CallOrFactor    ::= FunctionCall | Literal | Identifier | "(" Expr ")" ;

FunctionCall    ::= Identifier "(" [ Expr ( "," Expr )* ] ")" ;
```

### 2.2 Tokenization Rules
- **Strings**: Single-quoted (`'...'`) or double-quoted (`"..."`), supporting standard escapes (`\n`, `\t`, `\"`, `\'`, `\\`).
- **Numbers**: Integers (`42`, `-7`) and IEEE 754 floats (`3.1415`, `0.05`).
- **Durations**: Format `<integer><unit>` where units are `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks). Examples: `15m`, `2h`, `7d`.
- **IP & CIDR**: Standard IPv4 (`192.0.2.1`), IPv6 (`2001:db8::1`), and CIDRs (`192.0.2.0/24`, `10.0.0.0/8`).
- **Wildcards**: Asterisk `*` (zero or more characters) and question mark `?` (exactly one character).
- **Time Literals**: Relative offsets (`earliest=-4h`, `latest=@now`) or ISO 8601 strings (`"2026-10-12T08:00:00Z"`).
- **Case-Sensitivity**:
  - **Field names**: Case-sensitive (`src_ip` $\ne$ `Src_Ip`).
  - **String comparisons in search**: Default case-insensitive (`action="blocked"` matches `"BLOCKED"`).
  - **Strict equality in eval**: `=~` / `==` are case-insensitive by default; `===` and `strict_eq(a, b)` are case-sensitive.
- **Comments**: `#` or `//` to the end of the line.

---

## 3. Data Model & Field Conventions

The dataset presented to BladeQL consists of normalized tabular records accompanied by raw syslog/JSON payloads.

### 3.1 Normalized Core Field Standard

| Core Field | Type | Description | Example |
|---|---|---|---|
| `timestamp` | `timestamp` | ISO 8601 UTC event time | `2026-10-12T08:14:22.105Z` |
| `source` | `string` | Telemetry provider / stream | `auth`, `endpoint`, `firewall`, `dns` |
| `host` | `string` | Reporting or affected machine | `ws-finance-02.corp.internal` |
| `user` | `string` | User principal account | `jdoe`, `svc-backup`, `root` |
| `src_ip` | `ip` | Source IP address | `192.0.2.45` |
| `dest_ip` | `ip` | Destination IP address | `198.51.100.12` |
| `src_port` | `number` | Source TCP/UDP port | `49210` |
| `dest_port` | `number` | Destination TCP/UDP port | `443` |
| `action` | `string` | Normalized action verb | `allow`, `block`, `logon`, `execute` |
| `outcome` | `string` | Result status | `success`, `failure`, `timeout` |
| `process` | `string` | Process binary name | `powershell.exe`, `curl`, `sudo` |
| `command_line` | `string` | Full execution command line | `powershell.exe -enc AAAA...` |
| `parent_process` | `string` | Parent process binary | `explorer.exe`, `cmd.exe` |
| `file_path` | `string` | File path accessed/created | `C:\Users\jdoe\AppData\payload.exe` |
| `file_hash` | `string` | SHA-256 hash of payload | `e3b0c44298fc1c149afbf4c8996fb924...` |
| `domain` | `string` | Queried or target domain | `portal-login.example` |
| `url` | `string` | Full HTTP request URL | `https://portal-login.example/auth` |
| `http_method` | `string` | HTTP verb | `GET`, `POST` |
| `status_code` | `number` | HTTP status code | `200`, `401`, `404` |
| `bytes_in` | `number` | Inbound byte count | `1420` |
| `bytes_out` | `number` | Outbound byte count | `58200` |
| `message_id` | `string` | Mail gateway message ID | `<msg-882@corp.internal>` |
| `sender` | `string` | Email sender address | `billing@vendor-update.example` |
| `recipient` | `string` | Email recipient address | `jdoe@corp.internal` |
| `subject` | `string` | Email subject line | `Invoice #9921 attached` |
| `_raw` | `string` | Raw unparsed log text | `Oct 12 08:14:22 fw01 ASA: %ASA-4-106023...` |

### 3.2 Source-Native Inconsistencies (Realistic Field Variance)

To replicate realistic SIEM triage, raw logs retain native provider aliases that learners must discover or map:
- Firewall logs emit `src` and `dst` alongside normalized `src_ip`/`dest_ip`.
- Windows Event Logs emit `EventCode` (e.g. `4624`, `4625`), `TargetUserName`, and `IpAddress`.
- Web proxies emit `client_ip` and `cs_method`.

---

## 4. Complete Command Set Specification

### 4.1 Filtering & Shaping
1. `where <boolean-expr>`: Evaluates an expression for each row, discarding rows evaluating to false or null. Example: `| where bytes_out > 10000 and status_code == 200`
2. `search <search-expr>`: Piped secondary full-text or field search. Example: `| search src_ip in 192.0.2.0/24`
3. `fields [+|-] <field1>, <field2>`: Selects or removes specific fields from output.
4. `table <field1>, <field2>`: Strict tabular projection and ordering of specified columns.
5. `rename <old> as <new>`: Renames columns with collision checks.
6. `head <N>`: Returns first $N$ rows deterministically.
7. `tail <N>`: Returns last $N$ rows deterministically.
8. `limit <N>`: Synonym for `head N`.
9. `dedup <field1>, <field2>`: Retains only the first occurrence for each distinct tuple of values.
10. `sort [-|+]<field1>, [-|+]<field2>`: Stable typed sorting (numeric, timestamp, string). Nulls sort last unless prefixed with `+`.

### 4.2 Computation (`eval`) & Standard Library Functions
Syntax: `| eval <target> = <expression>`

- **Logical & Branching**:
  - `if(condition, true_val, false_val)`
  - `case(cond1, val1, cond2, val2, ..., default_val)`
  - `coalesce(val1, val2, ...)`: First non-null value.
  - `isnull(val)` / `isnotnull(val)`
- **String Functions**:
  - `lower(s)` / `upper(s)`
  - `len(s)`: String character length.
  - `substr(s, start, [length])`: 1-based indexing.
  - `replace(s, target, replacement)`: Safe literal string replacement.
  - `split(s, delimiter)`: Splits into an array.
  - `trim(s)`: Trims whitespace.
  - `contains(s, needle)` / `startswith(s, prefix)` / `endswith(s, suffix)`
  - `concat(s1, s2, ...)`
- **Numeric & Math**:
  - `tonumber(val)`: Coerces string to number or null.
  - `tostring(val)`: Formats to string.
  - `round(n, [decimals])` / `floor(n)` / `ceil(n)` / `abs(n)`
- **Time Functions**:
  - `now()`: Returns the scenario's pinned `@now` epoch milliseconds.
  - `strftime(timestamp, format)`: Formats timestamp using safe tokens (`%Y`, `%m`, `%d`, `%H`, `%M`, `%S`).
  - `strptime(string, format)`: Parses formatted date into epoch milliseconds.
  - `time_diff(t1, t2, unit)`: Calculates delta in `s`, `m`, `h`, `d`.
  - `relative_time(t, duration)`: Shifts time by offset (e.g., `-1h`).
- **Networking & CIDR**:
  - `cidrmatch(ip, cidr)`: Returns boolean indicating membership.
  - `is_private(ip)`: True if RFC 1918 / RFC 4193 private IP.
- **Security Presentation Helpers**:
  - `defang(val)`: Converts `http://evil.example` to `hxxp://evil[.]example`.
  - `refang(val)`: Reconstitutes defanged representations.

### 4.3 Aggregation & Analytics
1. `stats <agg>(<field>) [as <alias>] by <group_fields>`:
   - Aggregators: `count`, `dc` (distinct count), `sum`, `avg`, `min`, `max`, `median`, `stdev`, `values` (unique set up to 100 entries), `list` (bounded array up to 50 entries), `first`, `last`, `earliest`, `latest`.
2. `top [N] <field> [by <group>]`: Computes top $N$ most frequent values with raw counts and percentages.
3. `rare [N] <field> [by <group>]`: Computes bottom $N$ least frequent values with counts and percentages.
4. `timechart span=<duration> <agg>(<field>) [by <facet>]`: Buckets timestamps into regular temporal bins (e.g. `15m`, `1h`) and computes aggregations per slice.
5. `bucket <field> span=<duration> as <alias>`: Discretizes time or numbers into fixed intervals.
6. `eventstats <agg>(<field>) by <group_fields>`: Computes aggregation across the stream and attaches result as a new column to every individual input event without collapsing rows.
7. `streamstats <agg>(<field>) by <group_fields>`: Calculates running cumulative aggregate over the stream.
8. `session by <field> maxgap=<duration>`: Sessionizes events where gap between consecutive timestamps exceeds threshold, outputting `session_id`, `session_start`, `session_end`, `session_duration`, `event_count`.

### 4.4 Extraction & Multi-Source
1. `parse "<template>" from <field>`:
   - Delimiter and wildcard template extraction.
   - Example: `| parse "* - - [*] \"* * *\" * *" from _raw as (src_ip, ts, method, uri, proto, status, bytes)`
2. `extract /<safe-regex>/ from <field>`:
   - Named group extraction using safe linear-time regex engine.
   - Example: `| extract /(?<session_token>[a-f0-9]{32})/ from command_line`
3. `union [ <subsearch> ]` / `append [ <subsearch> ]`:
   - Concatenates results of a bounded subsearch pipeline.
4. `join <key> [ <subsearch> ]`:
   - Hash join (left or inner) between primary dataset and subsearch results on matching key.
5. `lookup assets <field>`:
   - Cross-references host or user against static scenario CMDB/directory, appending `asset_owner`, `criticality`, and `zone`.

---

## 5. Safe Linear-Time Regex Engine (ReDoS Immunity)

Standard ECMAScript regular expressions are vulnerable to Exponential Backtracking (Catastrophic Backtracking) on hostile or deeply nested patterns.

BladeQL addresses this through a custom, verified **Pike/Thompson Virtual Machine (NFA)** matcher:
- **Supported Subset**:
  - Literals and escaped characters (`\d`, `\w`, `\s`, `\D`, `\W`, `\S`).
  - Character classes (`[a-zA-Z0-9_-]`, negated `[^0-9]`).
  - Metacharacters: `.` (any char), `^` (start), `$` (end).
  - Grouping: `(...)` and named capture groups `(?<name>...)`.
  - Alternation: `a|b|c`.
  - Quantifiers: `*`, `+`, `?`, and bounded repetitions `{m,n}` (where $n \le 100$).
  - Flags: `i` (case-insensitive).
- **Prohibited Syntax (Rejected with immediate parsing error)**:
  - Backreferences (`\1`, `\2`).
  - Lookahead and lookbehind (`(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)`).
  - Unbounded nested quantifiers (`(a+)+`, `(a*)*`).
- **Complexity Bound**:
  - Time complexity is strictly linear with respect to input length: $O(M \cdot N)$ where $M$ is NFA states and $N$ is text length.
  - Step budget: Execution aborts with a graceful error if NFA state transitions exceed 25,000 steps.

---

## 6. Execution Model, Safety Budgets & Infrastructure

### 6.1 Execution Location: Server-Side vs Web Worker

| Dimension | Server-Side Execution (Recommended Architecture) | Client-Side Web Worker |
|---|---|---|
| **Anti-Tamper & Cheating** | Complete immunity. Ground-truth questions and scoring logic never touch browser memory. | Risk: Learner could inspect Worker memory or modify AST visitor. |
| **Audit Logging** | Instant server logging of every query for analytical thoroughness scoring. | Requires client network pingbacks that can be dropped or faked. |
| **Offline Capability** | Requires connection to local server or Next.js development server. | Runs offline in browser cache. |
| **Resource Control** | Uniform execution environment, exact deterministic timeouts. | Dependent on end-user hardware, thermal throttling, mobile cores. |

**Verdict**: The primary execution runs via a dedicated Server Action pipeline (`soc-query.ts`) utilizing the shared, pure TypeScript engine. Because the engine has zero Node-specific runtime dependencies, it can execute either server-side or in-browser.

### 6.2 Hard Resource Budgets

Every query is executed under strict deterministic budgets:
1. `maxQueryLength`: 4,000 characters.
2. `maxPipelineStages`: 25 commands.
3. `maxSubsearchDepth`: 1.
4. `maxEventsScanned`: 200,000 events.
5. `maxResultRows`: 10,000 rows (results above this are truncated with a visible banner).
6. `maxIntermediateRows`: 50,000 rows.
7. `maxDistinctGroupKeys`: 5,000 keys (prevents memory exhaustion on high-cardinality `stats by url`).
8. `maxExecutionSteps`: 500,000 interpreter steps.
9. `maxWallClockSafetyMs`: 2,000ms cooperative safety watchdog.

---

## 7. Investigation Questions Model (SAL1 / BTL1 Style)

Real certification exams (Security Analyst Level 1, Blue Team Level 1) assess investigation skills through concrete factual questions answered via log analysis.

### 7.1 Question Taxonomy & Normalization
1. **Numeric**: E.g., count of distinct attacking IPs, total failed logins. Accepts numbers with whitespace trimming.
2. **Entity / String**: IP address, user account, hostname, file hash, binary name. Normalization:
   - Case-insensitive for users/hosts/IPs.
   - Accepts both plain and defanged URLs/domains (`hxxp://...` $\equiv$ `http://...`).
   - Accepts IPv6 in compressed and uncompressed form.
3. **Timestamp**: Exact minute or seconds of initial compromise. Tolerance: $\pm 60$ seconds allowed around true epoch.
4. **Single Choice / Multiple Select**: Categorical identification from plausible distractors sampled directly from the scenario's background dataset.
5. **Event Ordering**: Chronological sequencing of 3-5 key forensic milestones.

### 7.2 Generation-Time Answer Verification
- Investigation question answers are **never** hardcoded.
- Each question template defines a canonical **Reference Query**.
- At scenario generation time, the engine executes the reference query against the generated dataset to compute the ground-truth answer vector.
- The reference query and answer vector are stored exclusively in the server-side scenario session (`soc_question_attempts`) and are never delivered to the client during an active attempt.

---

## 8. Threat Model & Mitigations

```
+-------------------------------------------------------------------------------------------------+
|                                    BLADEQL THREAT MATRIX                                        |
+------------------------------------+------------------------------------------------------------+
| Threat Vector                      | Architectural Defense                                      |
+------------------------------------+------------------------------------------------------------+
| 1. Prototype Pollution             | Field maps and symbols stored in Object.create(null)       |
|                                    | and native ES6 Map instances. Object.prototype frozen.     |
+------------------------------------+------------------------------------------------------------+
| 2. ReDoS (Catastrophic Regex)      | Pike/Thompson NFA VM. Rejects backrefs & lookarounds.      |
|                                    | 25,000-step execution hard limit.                          |
+------------------------------------+------------------------------------------------------------+
| 3. High-Cardinality DoS            | stats/timechart enforce 5,000 distinct group key limit.    |
|                                    | Aborts with friendly "narrow your query" guidance.         |
+------------------------------------+------------------------------------------------------------+
| 4. Ground-Truth Data Leakage       | Dataset contains only raw operational logs. Ground truth   |
|                                    | stored in isolated server tables; stripClientView applied. |
+------------------------------------+------------------------------------------------------------+
| 5. Timing Side-Channel             | Query execution cost depends strictly on query AST and     |
|                                    | dataset record count, not on malicious event content.      |
+------------------------------------+------------------------------------------------------------+
| 6. CSV Formula Injection           | All exported CSV cells prefixed with single quote (')      |
|                                    | if starting with '=', '+', '-', '@', tab, or CR.           |
+------------------------------------+------------------------------------------------------------+
| 7. Cross-Tenant Attempt Tampering  | RLS policies enforce auth.uid() == attempt.user_id.        |
+------------------------------------+------------------------------------------------------------+
```

---

## 9. Educational Seams & Future Extensions

1. **Investigative Thoroughness Scoring (Prompt 6)**:
   - The query log records every query executed during an attempt. Future scoring algorithms can evaluate query diversity, filter specificity, and pivot velocity.
2. **AI Handler Context (Prompt 8)**:
   - The Handler tutoring assistant can inspect recent failing queries and offer targeted pedagogical hints ("Consider checking the destination port on outbound proxy connections") without solving the query.
3. **Report Evidence Embedding (Prompt 6)**:
   - Learners can click "Attach to Case" on any query result row, embedding a tamper-proof pointer to the exact query and timestamp into their incident debrief.
4. **Exam Mode Budgets (Prompt 7)**:
   - In certification exam mode, query quotas (e.g. max 50 queries) and question attempt limits (max 2 attempts per question) are enforced.

---

*End of Design Brief. Next Phase: Implementation of Part B (Lexer, Parser, AST, Safe Regex Engine, Type System).*

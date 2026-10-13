# BladeQL Investigation Query Language: Developer & Analyst Reference (v1.0.0)

## Overview & Philosophy
**BladeQL** is CyberBLADE's original, pipeline-based log investigation query language. Designed specifically for security operations education, BladeQL allows learners to hunt across diverse enterprise telemetry streams (Authentication, Firewall, Endpoint, DNS, Web Proxy, and Mail Gateway) using intuitive, composable pipelines.

BladeQL is **safe by construction**:
- **No dynamic execution:** Evaluated entirely by a pure TypeScript AST interpreter with zero calls to `eval()`, `new Function()`, or dynamic code execution.
- **Linear-Time Regular Expressions:** Uses a custom Pike VM NFA engine enforcing $O(M \cdot N)$ matching with zero ReDoS vulnerability.
- **Strict Deterministic Resource Budgets:** Enforces step-count limits, row caps, and timeout safeguards.
- **Prototype Pollution Defense:** Operates exclusively using `Object.create(null)` or own-property sanitized maps.

---

## 1. Syntax & Pipeline Model
A BladeQL query begins with an optional **Base Search Filter**, followed by zero or more piped transformation stages separated by the pipe symbol (`|`):

```text
[base_search] | command_1 [args] | command_2 [args] | ...
```

### 1.1 Comments & Formatting
- **Line Comments:** Prefix with `//` or `#`. Comments continue to the end of the line.
- **Case Sensitivity:**
  - Command names (`where`, `stats`, `eval`) and operators (`and`, `or`, `in`) are case-insensitive.
  - Field names (`user`, `src_ip`, `EventCode`) are case-sensitive to preserve telemetry fidelity.
  - String literals (`"failure"`, `'admin'`) use case-insensitive equality by default. Use `===` for strict case-sensitive comparisons.

---

## 2. Base Search Filtering
The base search filters the raw log stream before subsequent pipeline transformations.

### 2.1 Keyword Searches
- Bare strings match across any client-visible field or the `_raw` log text:
  ```bladeql
  powershell
  "mimikatz"
  ```
- Wildcards (`*` and `?`) are supported:
  ```bladeql
  login.*.example
  admin*
  ```

### 2.2 Field Filters
- Equality: `source="auth"`, `outcome="failure"`, `EventCode=4625`
- Inequality: `action!="allow"`, `dest_port!=80`
- Comparisons: `bytes_out > 50000`, `status_code >= 400`
- Set Membership: `process in ("cmd.exe", "powershell.exe", "wscript.exe")`
- CIDR Subnets: `src_ip in 192.168.1.0/24`, `dest_ip in 10.0.0.0/8`
- Regular Expression Match: `command_line =~ /-[eE][nN][cC]/`

---

## 3. Pipeline Command Reference

### Filtering & Shaping Commands
| Command | Syntax | Description |
| :--- | :--- | :--- |
| `where` | `where <expr>` | Filters stream matching a boolean expression. |
| `search` | `search <expr>` | Alias for where filtering within pipelines. |
| `table` | `table <f1>, <f2>...` | Restricts output strictly to specified columns in order. |
| `fields` | `fields [+] <f1>, ...` or `fields - <f1>...` | Keeps or removes specified fields from the stream. |
| `sort` | `sort [-]<field>...` | Sorts stream ascending (or descending with `-` prefix). |
| `head` | `head <N>` | Keeps only the first N rows of the stream. |
| `tail` | `tail <N>` | Keeps only the last N rows of the stream. |
| `dedup` | `dedup <f1>, <f2>...` | Removes consecutive duplicate rows based on field values. |
| `rename` | `rename <old> as <new>` | Renames an output field. |
| `limit` | `limit <N>` | Alias for `head <N>`. |

### Aggregation Commands (`stats`)
Computes metrics grouped by zero or more fields:
```bladeql
stats <agg_func>(<field>) [as <alias>]... by <group_fields>
```

#### Supported Aggregation Functions
- `count` / `count(<field>)`: Count total events or non-null values.
- `dc(<field>)`: Distinct count (cardinality).
- `sum(<field>)`: Sum of numeric values.
- `avg(<field>)`: Arithmetic mean of numeric values.
- `min(<field>)`: Minimum numeric or lexicographic value.
- `max(<field>)`: Maximum numeric or lexicographic value.
- `values(<field>)`: Deduplicated list of distinct values (up to 100 items).
- `list(<field>)`: Ordered list of observed values (up to 100 items).
- `earliest(<field>)`: Chronologically earliest value in group.
- `latest(<field>)`: Chronologically latest value in group.

### Specialized Analytical Commands
- `top <N> <field> [by <group>]`: Computes top talkers and highest-frequency values with percentage.
- `rare <N> <field> [by <group>]`: Anomaly detection command finding least frequent values.
- `timechart span=<dur> <agg> by <field>`: Bins metrics into temporal buckets (e.g. `span=15m`).
- `session by <field> maxgap=<dur>`: Clusters contiguous events into discrete sessions with duration and event counts.
- `lookup assets <field>`: Enriches events with internal asset and identity directory metadata.

---

## 4. Evaluation & Expression Language (`eval`)
The `eval` command computes new fields or transforms existing fields using deterministic functions:

```bladeql
eval <field> = <expression>
```

### Built-in Expression Functions
- **String Functions:**
  - `lower(str)`, `upper(str)`: Case conversion.
  - `len(str)`: String length.
  - `substr(str, start, len)`: Substring extraction.
  - `contains(str, needle)`: True if needle is found within string.
  - `startswith(str, prefix)`, `endswith(str, suffix)`: Prefix/suffix checks.
  - `replace(str, find, rep)`: Literal string replacement.
  - `trim(str)`: Whitespace trimming.
  - `concat(a, b, ...)`: String concatenation.
- **Numeric & Math Functions:**
  - `round(num, decimals)`: Rounds to decimal precision.
  - `floor(num)`, `ceil(num)`, `abs(num)`: Standard math primitives.
  - `tonumber(str)`: Parses string to numeric float.
- **Conditional Logic:**
  - `if(condition, true_val, false_val)`: Ternary branch.
  - `coalesce(v1, v2, ...)`: First non-null value.
  - `isnull(val)`, `isnotnull(val)`: Null checks.
- **Network Helpers:**
  - `cidrmatch(cidr, ip)`: Tests IP against CIDR subnet.
  - `is_private(ip)`: Returns 1 if IP is RFC 1918 / loopback, 0 otherwise.

---

## 5. Threat Hunting Tutorial & Common Patterns

### Hunt 1: Credential Spraying / Brute Force
Identify external IP addresses hitting multiple corporate accounts:
```bladeql
source="auth" outcome="failure"
  | stats count, dc(user) by src_ip
  | where count > 5 and "dc(user)" > 2
  | sort -count
```

### Hunt 2: Rare Endpoint Process Hierarchies
Detect anomalous command interpreters launched by office software:
```bladeql
source="endpoint"
  | where parent_process in ("winword.exe", "excel.exe", "outlook.exe")
  | table timestamp, host, user, parent_process, process, command_line
```

### Hunt 3: High-Volume Data Staging & Exfiltration
Isolate hosts transmitting large volumes of outbound data to external IP addresses:
```bladeql
source="firewall" action="allow"
  | where not is_private(dest_ip)
  | stats sum(bytes_out) as total_bytes by host, src_ip, dest_ip
  | eval total_mb = round(total_bytes / 1048576, 2)
  | sort -total_bytes
  | head 10
```

---

## 6. Resource Limits & Operational Budgets
To guarantee responsive interactive execution and defeat denial-of-service attempts:
- Max Query Length: 4,000 characters
- Max Pipeline Stages: 25 stages
- Max Events Scanned: 200,000 events
- Max Intermediate Stream Rows: 50,000 rows
- Max Result Rows: 10,000 rows (results beyond this are cleanly flagged with a truncation banner)
- Max Execution Steps: 500,000 steps
- Wall-Clock Timeout Safety: 2,000 ms

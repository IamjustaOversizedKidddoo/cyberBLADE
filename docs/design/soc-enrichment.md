# CyberBLADE SOC Simulator: Enrichment and Evidence Layer Design Brief

**Document:** `docs/design/soc-enrichment.md`  
**Phase:** Phase 3 — Tier-1 SOC Analyst Track (Prompt 4)  
**Status:** Approved Architecture Plan  
**Target:** Enrichment & Evidence Tool Suite for Procedural SOC Workspace  

---

## 1. Executive Summary & Philosophy

In modern Security Operations Centers (SOC), Tier-1 analysts do not triage alerts in a vacuum. Alerts are starting points—signals that trigger deliberate, investigative corroboration across diverse external intelligence services and internal telemetry viewers. 

The **CyberBLADE Enrichment and Evidence Layer** provides a suite of 10 fully simulated investigation tools and cross-tool pivoting mechanisms within the procedural SOC workspace.

### Core Architectural Axioms
1. **100% Synthetic & Network-Isolated**: Every reputation score, WHOIS record, passive DNS history, email header, sandbox detonation report, packet capture, endpoint timeline, and CMDB entry is generated deterministically server-side from the scenario seed and hidden ground truth. Under no circumstances does the platform make outbound network requests to live threat-intel feeds, DNS servers, or external APIs.
2. **The "Imperfect Truth" Model**: Security tools disagree, feeds suffer from false positives and false negatives, newly registered domains may be benign marketing launches, and internal CMDB records are occasionally stale. An analyst must synthesize multiple weak signals into reasoned evidence rather than search for an artificial "malicious" badge.
3. **Zero Form-Based or Timing Tells**: Benign and malicious indicators follow identical field distributions, structure envelopes, and server latency profiles. The server never leaks ground truth through response formats or execution timing.
4. **Server-Authoritative & Audit-Logged**: All lookups occur on-demand via server actions/endpoints with strict attempt ownership checks. Every lookup is recorded in an immutable audit log (`soc_enrichment_lookups`) enabling subsequent investigation grading, Handler pedagogical guidance, and exam budget accounting.

---

## 2. Tool Catalogue

The enrichment workbench provides 10 integrated tools accessible via indicator clicks, keyboard shortcuts, or a unified indicator lookup bar:

```
+------------------------------------------------------------------------------------------------+
| SOC WORKSPACE: ENRICHMENT & EVIDENCE WORKBENCH                                                |
+------------------------------------+-----------------------------------------------------------+
| Global Indicator Search            | Active Tool Panel (Docked Drawer / Fullscreen Sheet)      |
| [ 198.51.100.24            ] [Go]  |                                                           |
+------------------------------------+                                                           |
| 1. Indicator Reputation & Context   | [ ThreatWatch Community: 4/12 ]  [ Apex Intel: 68/100 ]   |
| 2. WHOIS / Registration Records    | Disagreement Detected: Moderate Suspicion                 |
| 3. Passive DNS History             |                                                           |
| 4. Email Header Analyzer           | First Seen: 2026-10-08 | Last Seen: 2026-10-12            |
| 5. URL Analysis & Redirects        | Related Infrastructure: login.portal.example (pDNS)       |
| 6. File & Sandbox Reports          +-----------------------------------------------------------+
| 7. Network Flow & Packet View      | Pivot Actions: [View pDNS] [Check WHOIS] [Attach to Case] |
| 8. Endpoint Process Tree & Timeline|                                                           |
| 9. Asset & Identity Directory      | Audit Trail: Logged at 08:42:15 UTC (Attempt #att-01)      |
| 10. Internal Case & Ticket History |                                                           |
+------------------------------------+-----------------------------------------------------------+
```

### 1. Indicator Reputation and Context Panel
- **Purpose**: Aggregates threat intelligence from simulated external feeds.
- **Supported Entity Types**: IPv4, IPv6, Domain, URL, SHA256/MD5 Hash, Email Address.
- **Attributes**: Source-by-source verdicts, confidence percentages, threat categories, first/last seen timestamps, and community commentary snippets.
- **Key Realism Rule**: Disagreements are explicitly displayed side-by-side without an omnibus "verdict banner". A "No Data Found" response is a standard, realistic outcome for obscure or targeted infrastructure.

### 2. WHOIS & Registration View
- **Purpose**: Domain and IP ownership reconnaissance.
- **Supported Entity Types**: Domain, IPv4, IPv6.
- **Attributes**: Registrar placeholder name, creation date, updated date, expiration date, name servers, privacy-protected registrant status, hosting provider, Autonomous System Number (ASN), and CIDR block.
- **Key Realism Rule**: Synthetic placeholder entities; RFC 5737 IP blocks and reserved `.example`, `.test`, `.corp.internal` domains.

### 3. Passive DNS / Historical Resolution View
- **Purpose**: Historical mapping between domains and IP addresses over time.
- **Supported Entity Types**: Domain, IPv4.
- **Attributes**: Forward resolution table (Domain $\rightarrow$ IPs over time), Reverse resolution table (IP $\rightarrow$ Domains hosted), first seen, last seen, TTL, query count.
- **Key Realism Rule**: Highlights shared hosting (multiple benign domains sharing a cloud IP) vs dedicated adversary infrastructure.

### 4. Email Header Analyzer
- **Purpose**: Deconstructs email message routing and authenticity.
- **Input**: Raw RFC 5322 header text or one-click extraction from Mail Gateway alerts.
- **Views**:
  - *Hop-by-Hop Received Chain*: Parsed MTA relay nodes, reverse-DNS match flags, and delay durations between hops.
  - *Authentication Alignment*: SPF (pass/fail/softfail/none with IP match details), DKIM (pass/fail/none with signing domain), DMARC (pass/fail with alignment check).
  - *Header Consistency*: `From` vs `Return-Path` vs `Reply-To` comparison with highlighted discrepancies.
  - *Body & Link Inspector*: Extracts all links, compares visible anchor text against actual target URL, displays targets in defanged monospace format (`hxxps[://]...`), with a one-click "Copy Defanged" button.
  - *Attachment Descriptors*: Non-downloadable metadata cards (filename, mime type, size, synthetic SHA256 hash).

### 5. URL Analysis View
- **Purpose**: Inspects suspicious web links safely.
- **Supported Entity Types**: URL.
- **Attributes**: URL component breakdown (scheme, domain, port, path, parameters), simulated redirect chain (HTTP 301/302 hops), abstract page behavior summary (e.g., "Presents credential login form mimicking corporate SSO", "Triggers immediate script download"), and wireframe placeholder representation (neutral SVG layout avoiding trademarked brand marks).

### 6. File & Sandbox Detonation Report View
- **Purpose**: Analyzes binary files, scripts, and document attachments.
- **Supported Entity Types**: File Hash (SHA256), Filename.
- **Attributes**: File metadata (size, MIME type, compile timestamp, file entropy), abstract behavioral categories:
  - Process execution tree (`cmd.exe /c powershell.exe ...`)
  - File system modifications (temporary staging in `%APPDATA%`)
  - Registry modifications (Run key persistence additions)
  - Network connections (outbound HTTP beacons, DNS lookups)
- **Key Realism Rule**: Imperfect detection—obfuscated or evasive malware may show low behavioral anomaly scores, while legitimate administrative software may appear noisy.

### 7. Network Flow & Packet Evidence View
- **Purpose**: Deep inspection of network traffic for an IP or time window.
- **Engine Reuse**: Reuses CyberBLADE's core packet engine table, filter parser, and hex/ASCII stream viewer (`lib/lab-engine/packet/`).
- **Features**:
  - Flow summary table (timestamp, src IP/port, dst IP/port, protocol, bytes, packets, duration, flags).
  - Synthetic PCAP packet view for relevant incident stages (DNS query/response pairs, HTTP requests/responses, TLS Client Hello metadata).
  - Traffic analytics: Top talkers bar summary, DNS query frequency breakdown, inter-arrival time periodicity detector for C2 beacon discovery.
  - Formula-injection-safe CSV export (defends against leading `=`, `+`, `-`, `@`).

### 8. Endpoint Timeline & Process Tree View
- **Purpose**: Chronological host-level event reconstruction.
- **Supported Entity Types**: Hostname, Asset ID.
- **Features**:
  - Hierarchical collapsible process tree (`explorer.exe` $\rightarrow$ `winword.exe` $\rightarrow$ `powershell.exe`) with command lines, user context, process integrity level, and PID/PPID.
  - Chronological host event timeline combining process creation, file modifications, network socket connections, and Windows Security logons.
  - Telemetry Gap Visualization: Honestly depicts periods where logging was degraded or agent communication dropped as "Telemetry Unavailable" blocks rather than hiding missing data.
  - Keyboard navigation supporting WAI-ARIA `tree` and `treeitem` standards.

### 9. Asset & Identity Directory (CMDB/IdP)
- **Purpose**: Internal organizational context on impacted hosts and users.
- **Supported Entity Types**: Hostname, Username, Email, IP Address.
- **Attributes**:
  - *User Cards*: Department, job title, manager, working hours, privileged group memberships, multi-factor authentication (MFA) method, recent anomalous sign-in history.
  - *Host Cards*: Hostname, role (Domain Controller, Database, Workstation), OS, owner, environment zone, business criticality, known maintenance windows.
- **Key Realism Rule**: Includes a controlled 10–15% rate of stale records (e.g., employee transferred departments 2 weeks ago, or host decommissioned) reflecting real corporate directory hygiene.

### 10. Internal Case History & IT Ticket Lookup
- **Purpose**: Investigates whether anomalous activity was pre-approved or reported by IT.
- **Supported Entity Types**: Hostname, Username, IP, Application Name.
- **Attributes**: Ticket ID, submitter, category (Change Request, Helpdesk Incident, Scheduled Maintenance, Vulnerability Scan Window), approval status, timestamps, and notes.
- **Key Realism Rule**: Contains approved maintenance records that explain benign twins (e.g., approved backup sync), as well as outdated or irrelevant tickets that test analyst discernment.

---

## 3. The "Imperfect Truth" Intelligence Model

To prevent enrichment lookups from becoming a trivial "cheat code", simulated sources embody realistic error profiles and coverage constraints:

| Simulated Source | Source Archetype | Primary Strengths | Inherent Limitations | Error Profile |
|:---|:---|:---|:---|:---:|
| **ThreatWatch Community** | Open Community Intelligence Feed | Broad coverage, fast crowdsourced reporting of mass campaigns | High false-positive rate on shared infrastructure, noisy scores | Coverage: 85%<br>FP: 12%<br>FN: 15% |
| **Apex Intel** | Commercial Threat Intelligence | High precision, vetted indicator feeds, curated attribution | Slower to ingest novel infrastructure; conservative scoring | Coverage: 70%<br>FP: 3%<br>FN: 20% |
| **PassiveSphere pDNS** | Passive DNS & Resolution Archive | Comprehensive historical mapping of DNS infrastructure | Historical lag; shared cloud IPs produce false associations | Coverage: 88%<br>Shared IP ambiguity |
| **DetonateX Sandbox** | Automated Malware Detonation Engine | Deep behavioral execution capture and process trees | Misses environmental/evasive malware; noisy on legitimate installers | Coverage: 65%<br>FP: 8%<br>FN: 25% |
| **CorpHive CMDB / IdP** | Enterprise Directory & Asset Management | Authoritative internal hardware and employee mappings | Stale records (10–15% outdated department or asset assignment) | Staleness: 12% |

### Synthesis Rules Enforced by Generator:
1. **Never a Single-Source Answer**: No single lookup returns an unambiguous verdict banner. An analyst must cross-reference at least two evidence sources (e.g., email header sender mismatch + sandbox process spawn, or pDNS resolution date + proxy byte transfer).
2. **Shared Infrastructure Ambiguity**: Major cloud hosting services (e.g., `cloud-storage.example`, `cdn-edge.example`) return mixed community reputations because both legitimate companies and threat actors leverage shared infrastructure.
3. **Disagreement is a Signal**: When *ThreatWatch* flags an IP but *Apex Intel* rates it clean, this reflects a newly observed or contested indicator, prompting the analyst to inspect raw host/network logs.

---

## 4. Deterministic Seeding Architecture

Enrichment output is a pure mathematical function of the scenario identity, the attempt seed, the target entity, and the tool requested:

$$\text{EnrichmentResult} = f(\text{ScenarioId}, \text{AttemptSeed}, \text{EntityType}, \text{EntityValue}, \text{Tool})$$

### Sub-Stream PRNG Derivation
Each query derives a deterministic sub-stream using SHA256 HMAC:
```typescript
const subStreamSeed = createSubStream(
  attemptSeed,
  `enrichment:${tool}:${entityType}:${entityValue.toLowerCase()}`
);
const rng = createPrng(subStreamSeed);
```
- **Invariance Guarantee**: Querying the same indicator from the same attempt at minute 1 or minute 45 produces byte-identical results.
- **Zero Memory Leaks**: Results are computed lazily on demand; the server does not store megabytes of pre-computed enrichment tables in memory.

---

## 5. Server Pipeline, Audit Logging & Rate Limits

### Route & Server Action Pipeline
All lookups traverse a unified, secure server pipeline:
`POST /api/labs/soc/enrichment` (or typed Server Action `lookupSocEnrichmentAction`):
1. **Authentication & Ownership Check**: Validates active session via `requireOperator()`. Confirms learner owns the target `attemptId`.
2. **Attempt State Verification**: Ensures attempt is `in_progress` (read-only historical view if `submitted`).
3. **Rate Limiting & Cost Budget**:
   - 60 requests/minute per learner.
   - 250 requests per scenario attempt.
   - Repeated lookups for the identical entity/tool are served from an in-memory attempt cache and do not consume rate limit tokens.
4. **Visibility & Scope Check**: Confirms the queried entity is either present in the client-visible scenario data (alerts, raw events, asset list) or was linked via previous tool outputs. Querying un-surfaced entities returns standard "No Data Found" and logs the blind search.
5. **Uniform Response Timing**: Server executes with controlled timing jitter (synthetic delay normalized to 35–55ms) to prevent side-channel timing analysis between known vs unknown or malicious vs benign entities.
6. **Immutable Audit Log**: Records entry in `soc_enrichment_lookups`.

### Database Schema: `soc_enrichment_lookups`
```sql
CREATE TABLE IF NOT EXISTS public.soc_enrichment_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.soc_attempts(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    response_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_soc_lookups_attempt ON public.soc_enrichment_lookups (attempt_id, created_at);
```
- RLS Policy: Owner-only via `auth.uid() = (SELECT user_id FROM soc_attempts WHERE id = attempt_id)`.
- Parity: Fully mirrored in local file-store repository (`ProgressData.socEnrichmentLookups`).
- GDPR/Privacy Compliance: Integrated with `deleteUserData()` cascading removal.

---

## 6. Threat Model & Anti-Tell Engineering

| Threat Vector | Adversarial Attack Scenario | Defense & Invariance Mechanism |
|:---|:---|:---|
| **Form Tells** | Analyst compares JSON keys or field presence between malicious and benign indicators. | Malicious and benign records use identical schema models, matching field sets, and equivalent string length distributions. |
| **Response Latency Tells** | Malicious entities take longer to query due to deeper enrichment chains. | Server pipeline normalizes response time to a uniform 35–55ms window with synthetic jitter clamp. |
| **Brute-Force Entity Enumeration** | Learner scripts lookups of dictionary words or sequential IPs to find scenario indicators. | Unobserved indicators return authentic "No Data Found" responses indistinguishable from genuine benign misses; all attempts logged; strict rate limits. |
| **Offline Hash/Seed Derivation** | Learner attempts to reverse the PRNG seed from client telemetry to precalculate reputations. | Attempt seeds are never transmitted to the client (`REVOKE SELECT (seed) ON soc_attempts FROM authenticated`). All lookups are server-computed. |
| **Network Leakage** | Code inadvertently calls real WHOIS or DNS servers, leaking user queries or triggering external rate limits. | Dedicated network-isolation unit test intercepts global `fetch`, `http.request`, and `net.Socket` to fail CI if any external socket is opened. |

---

## 7. UI Layout, Accessibility & Mobile Responsiveness

### Desktop Layout (1440px)
- Integrated into the SOC workspace as a right-hand **Investigation Drawer** docked alongside the Alert Detail panel.
- Collapsible, resizable, with tabbed quick-access to active lookups, recent query history, and case evidence attachments.
- Global indicator search bar at top of drawer with automatic type detection (IP, domain, hash, email, URL, user, host).

### Tablet (768px) & Mobile (390px) Layout
- Mobile views open the enrichment tools in a high-performance **Full-Screen Bottom Sheet / Dedicated Tab**.
- State persistence: switching between Queue, Alert Detail, Cases, and Enrichment preserves form inputs and cursor positions without data loss.

### Accessibility Standards (P7 / WCAG AAA)
- All interactive controls have visible focus rings (`focus-visible:ring-2 focus-visible:ring-cyan`).
- Async search and lookup updates announce progress via `aria-live="polite"` live regions.
- Hierarchical process trees follow WAI-ARIA `tree` / `treeitem` keyboard specs (`ArrowRight` expand, `ArrowLeft` collapse, `ArrowDown`/`ArrowUp` navigation).
- Defanged indicators rendered in monospace with distinct "Copy Defanged" button emitting pure plain text.
- CSV export routines sanitize formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with leading single quotes.

---

## 8. Integration Seams for Future Prompts

1. **Prompt 5 (Investigation Query Language & SIEM Search)**:
   - The entity and log schema established here feeds directly into the SIEM query builder (e.g., querying `rawFields` for specific IP or user indicators).
2. **Prompt 6 (Incident Report Editor & Grading)**:
   - The `soc_enrichment_lookups` log provides an objective basis for grading "Investigative Thoroughness" (e.g., did the analyst verify email headers before closing the phishing case?).
3. **Prompt 7 (AI Handler Tutoring & Guided Hints)**:
   - The Handler inspects the learner's lookup history to offer contextual, leak-free pedagogical Socratic nudges (e.g., "Have you checked whether that host's parent process is normal for that department?").
4. **Prompt 8 (Practical Exam Mode)**:
   - Exam sessions enforce strict investigation budgets (e.g., 25 maximum lookups per shift), testing analyst efficiency and prioritization under pressure.

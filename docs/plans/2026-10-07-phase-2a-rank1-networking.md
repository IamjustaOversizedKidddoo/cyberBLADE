# Phase 2A — Rank 1 · Networking (packet lab + network commands + 9 lessons) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A learner who has passed Rank 0 can study the Rank 1 networking module — 9 lessons with terminal labs that use simulated network commands and packet labs in a Wireshark-style capture viewer — while Rank 0 learners see Rank 1 as locked.

**Architecture:** Builds on Phase 1 unchanged in style: pure-TS engines in `lib/lab-engine/<type>/`, seeded generators, server-side answer checking, lessons as MDX + checks YAML gated by `npm run check:content`. Labs become *environment-generic*: a generator returns `env: { kind: "terminal", world } | { kind: "packet", capture }`, and the lab page picks the workspace by `env.kind`. The terminal world gains an optional `network` model, so `ip`, `ping`, `dig`, `curl`, `ss` and `traceroute` answer from simulated hosts — no real network access, ever.

**Tech Stack:** Phase 1 stack only. No new runtime dependencies.

**Spec:** `docs/specs/2026-10-06-platform-design.md` (§3.3 rank gates, §6 Rank 1 = B.L.A.D.E week 1, §7.1 `packet` lab type, §14 Phase 2). Also `CLAUDE.md`, `docs/curriculum/teaching-style.md`, `docs/curriculum/blade-roadmap.md` (Week 1: Networking & Protocols). Builds on `docs/plans/2026-10-06-phase-1-learning-engine-rank-0.md`.

**Phase 2 split (owner decision 2026-10-07):** 2A Networking (this plan) → 2B Linux module + terminal command growth → 2C Windows/PowerShell module + Rank 1 challenge → Handler (Groq + Gemini) → exam-readiness engine → achievements/streaks → Rank 2 → hosted foundation last, before beta.

## Global Constraints

- Local-first: no Supabase, login or deployment in this plan; storage stays behind the Phase 1 interfaces.
- Rank gate (spec §3.3): Rank N lessons and labs are only usable once the operator's rank ≥ N. Rank 1 is unlocked by passing the Rank 0 challenge.
- Lessons: full CLAUDE.md template, `teaching-style.md` (binding), `status: draft`, `last_reviewed: null`, 3–5 checks each with an explanation per option and ≥1 coverage objective per question, original text only, legal/authorization note in any lesson that shows attack technique.
- Every ```` ```console ```` command in a lesson must run in the lab engine (content gate). Networking examples run against `demoWorld()`, which gains a network.
- Simulated network only: no command may perform a real network request. Example addresses use RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and RFC 1918 private ranges; example names use `.example` / `example.com|net|org` (RFC 2606) — never real third-party hosts.
- One lab type per folder: `lib/lab-engine/packet/`. Answer keys never reach the browser (packet captures are sent; the generator's `answers` are not).
- Every lab has a solve test that solves it the way a learner would (filters / commands), across ≥5 seeds.
- Command output and error wording match real tools (iproute2 `ip`, iputils `ping`, BIND `dig` 9.18, curl 8, iproute2 `ss`, `traceroute` 2.1); Wireshark display-filter semantics for the supported subset.
- Commit messages end with the session's attribution line.

## Review Focus

1. A Rank 0 learner opens a Rank 1 lesson or lab URL directly (bookmark, shared link) → sent to the rank map with a "locked" notice; no attempt created, no XP. Test in Task 1.
2. Packet filter typos — `ip.addr = 10.0.0.1`, an unknown field, unbalanced parentheses, a bare word — → a readable error under the filter bar, the previous packet list stays, nothing crashes. Test in Task 4.
3. `ping host` without `-c` (real ping never stops) → explained error, not a hang. Test in Task 2.
4. Answers that are names vs addresses — `Example.COM` vs `example.com`, an IP with a trailing dot/space — → domain answers are case-insensitive, IP answers exact after trimming. Test in Task 6.
5. A capture of a few thousand packets stays responsive: filtering 3,000 packets takes < 50 ms. Test in Task 4.

---

### Task 1: Rank-generic learning map and rank gating

**Files:**
- Create: `lib/progress/access.ts`
- Modify: `app/(app)/learn/core/page.tsx` (one section per core rank 0–2), `app/(app)/learn/[lessonId]/page.tsx`, `app/(app)/labs/[labId]/page.tsx`, `components/dashboard/CourseMap.tsx` (current rank's "Begin/Continue" button links to `/learn/core#rank-<n>`)
- Test: `tests/unit/lib/progress/access.test.ts`, `tests/e2e/rank-gate.spec.ts`

**Interfaces:**
- Produces:
  - `canAccessRank(operatorRank: number, contentRank: number): boolean` — `contentRank <= operatorRank`.
  - `LOCKED_NOTICE = "Locked — pass the Rank {n} challenge to open this."` with `lockedNotice(rank: number): string` (`{n}` = rank − 1).
  - Lesson and lab pages: when `!canAccessRank`, `redirect("/learn/core?locked=" + rank)` *before* `startLab` runs (no attempt created). The rank map shows `lockedNotice` in a `role="status"` box when `?locked=` is a valid rank.
  - Rank map: section per rank with id `rank-<n>`, heading `rank_<n> · <name>`; ranks above the operator's show their lesson titles greyed with a padlock and no links; each rank shows its challenge card (`getRankSummary(ctx, id, n)`) only when a challenge lab for that rank exists (`findChallengeLab` throws → no card).

- [ ] **Step 1: Failing tests:** `canAccessRank(0,0)` true, `(0,1)` false, `(1,0)` true, `(2,2)` true; `lockedNotice(1) === "Locked — pass the Rank 0 challenge to open this."`. E2E (desktop): new operator visits `/learn/core-r1-net-osi-01` → URL `/learn/core?locked=1` and the notice is visible; `/labs/core-r1-net-ip-lab-01` → same; `.data-e2e/progress.json` gains no attempt for that lab (read via the rank map showing no lab state — assert the lab page never rendered a terminal).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS (unit; the e2e needs Task 7's content — mark it `test.fixme` until then and un-fixme it in Task 8).
- [ ] **Step 3:** Commit `feat(progress): rank-generic learning map and rank gating`.

---

### Task 2: Simulated network model and network commands

**Files:**
- Create: `lib/lab-engine/terminal/network.ts` (model + helpers), `lib/lab-engine/terminal/commands/ip.ts`, `ping.ts`, `dig.ts`, `curl.ts`, `ss.ts`, `traceroute.ts`
- Modify: `lib/lab-engine/terminal/types.ts` (`World.network?: Network`), `lib/lab-engine/terminal/commands/index.ts`, `lib/lab-engine/terminal/demo-world.ts` (add a network + `/etc/resolv.conf`, `/etc/hosts`)
- Test: `tests/unit/lib/lab-engine/terminal/commands/{ip,ping,dig,curl,ss,traceroute}.test.ts`, extend `fixture-world.ts` with a network

**Interfaces:**
- Produces (`network.ts`):
  - `type Network = { interfaces: Iface[]; gateway: string; resolver: string; dns: Record<string, DnsRecords>; hosts: Record<string /*ip*/, Host>; listening: Listener[] }`
  - `type Iface = { name: string; mac: string; ipv4?: string /* "10.0.2.15/24" */; ipv6?: string; state: "UP" | "DOWN"; dynamic?: boolean }`
  - `type DnsRecords = { A?: string[]; AAAA?: string[]; CNAME?: string; MX?: { pref: number; host: string }[]; NS?: string[]; TXT?: string[] }` (keys are lowercase FQDNs without trailing dot)
  - `type Host = { name?: string; reachable: boolean; rttMs: number; ttl: number; hops: (string | null)[] /* router IPs, null = no reply */; http?: Record<string /*path*/, HttpResponse>; openPorts?: number[] }`
  - `type HttpResponse = { status: number; reason: string; headers: [string, string][]; body: string }`
  - `type Listener = { proto: "tcp" | "udp"; addr: string; port: number; process?: string }`
  - `resolveName(net, name): { ip: string } | { error: "NXDOMAIN" }` (follows CNAME, then A), `findHostByIp`.
- Pinned behaviour (assert exact strings in tests):
  - `ip addr` / `ip a` / `ip address show`: iproute2 format — `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000`, `    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00`, `    inet 127.0.0.1/8 scope host lo`, `       valid_lft forever preferred_lft forever`; then each interface `N: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000`, `link/ether <mac> brd ff:ff:ff:ff:ff:ff`, `inet <cidr> brd <broadcast> scope global dynamic eth0` (`dynamic` only when DHCP), `valid_lft 86313sec preferred_lft 86313sec` (dynamic) or `forever`. `ip route`: `default via <gw> dev eth0 proto dhcp src <ip> metric 100` + `<net>/<len> dev eth0 proto kernel scope link src <ip> metric 100`. `ip neigh`: `<gw> dev eth0 lladdr <mac> REACHABLE`. Unknown subcommand → `Object "x" is unknown, try "ip help".` code 1.
  - `ping -c N <host>` (N 1–10): `PING <name> (<ip>) 56(84) bytes of data.`, lines `64 bytes from <ip>: icmp_seq=<i> ttl=<ttl> time=<rtt> ms` (deterministic: `rtt = host.rttMs + (i - 1) * 0.1`, one decimal), blank line, `--- <name> ping statistics ---`, `N packets transmitted, N received, 0% packet loss, time <(N-1)*1000+4>ms`, `rtt min/avg/max/mdev = a/b/c/d ms` (3 decimals). Unreachable host: `From <own ip> icmp_seq=<i> Destination Host Unreachable` lines and `N packets transmitted, 0 received, +N errors, 100% packet loss, time …ms`, code 1. Unknown name: `ping: <name>: Name or service not known`, code 2. **No `-c`:** `ping: this lab needs -c <count> — real ping keeps going until you press Ctrl+C`, code 2.
  - `dig <name> [type]` / `dig +short <name> [type]` / `dig @<server> …`: `+short` prints one record per line (CNAME target first, then addresses). Full output follows BIND 9.18 layout: `; <<>> DiG 9.18.28 <<>> <args>`, `;; global options: +cmd`, `;; Got answer:`, `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: <seeded 5-digit>`, `;; flags: qr rd ra; QUERY: 1, ANSWER: <n>, AUTHORITY: 0, ADDITIONAL: 1`, blank, `;; OPT PSEUDOSECTION:`, `; EDNS: version: 0, flags:; udp: 65494`, `;; QUESTION SECTION:`, `;<name>.\t\t\tIN\t<TYPE>`, blank, `;; ANSWER SECTION:` records `<name>.\t\t300\tIN\t<TYPE>\t<data>`, blank, `;; Query time: 4 msec`, `;; SERVER: <resolver>#53(<resolver>) (UDP)`, `;; WHEN: Wed Oct 07 10:00:00 IST 2026`, `;; MSG SIZE  rcvd: <n>`. NXDOMAIN: status `NXDOMAIN`, `ANSWER: 0`, no ANSWER section.
  - `curl [-I] [-L] [-s] <url>`: `-I` prints `HTTP/1.1 <status> <reason>` + headers (`Name: value`) + blank line; without `-I` prints the body. `-L` follows `Location` up to 5 hops. Errors: `curl: (6) Could not resolve host: <host>` (code 6); unreachable or no web server: `curl: (7) Failed to connect to <host> port <port> after 3 ms: Couldn't connect to server` (code 7); unknown path → the host's 404 response.
  - `ss -tln` / `-tlnp` / `-uln` / `-tulnp`: header `State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process`; rows `LISTEN 0      4096   127.0.0.53%lo:53         0.0.0.0:*` (UDP rows use `UNCONN`; `-p` adds `users:(("<process>",pid=<n>,fd=3))`). Columns padded to the widest value.
  - `traceroute <host>`: `traceroute to <name> (<ip>), 30 hops max, 60 byte packets`, then ` 1  _gateway (<gw>)  0.412 ms  0.398 ms  0.381 ms`, router hops ` N  <ip> (<ip>)  a ms  b ms  c ms`, silent hops ` N  * * *`, last hop the target.
  - All commands read only `world.network`; a world without one → `ip`: shows only `lo`; others behave as "no network" (`connect: Network is unreachable` for ping, code 2; `curl: (7) …`).

- [ ] **Step 1: Failing tests** per command — pinned strings above for the fixture network (eth0 `10.0.2.15/24`, gw `10.0.2.2`, resolver `127.0.0.53`, hosts `www.example.com` (CNAME `example.com`), `example.com A 203.0.113.10` — RFC 5737 addresses only), plus: ping without `-c`; unknown name; unreachable host; `dig` NXDOMAIN; `curl -I` redirect + `-L`; `ss -tulnp`; traceroute with a `* * *` hop; a world with no network.
- [ ] **Step 2:** Run → FAIL. Implement `network.ts`, then one command at a time until its tests pass.
- [ ] **Step 3:** Extend `demoWorld()` with a network (eth0 `10.0.2.15/24` DHCP, gw `10.0.2.2`, resolver `127.0.0.53`, hosts `example.com`, `www.example.com`, `intranet.corp.example` with HTTP pages, one unreachable host, listeners sshd 22 and systemd-resolved 53) and `/etc/resolv.conf` (`nameserver 127.0.0.53`), `/etc/hosts`. `npm test` → PASS (existing tests unaffected: `help` lists the new commands — update its expected list).
- [ ] **Step 4:** Commit `feat(terminal): simulated network and ip/ping/dig/curl/ss/traceroute`.

---

### Task 3: Environment-generic labs (terminal | packet)

**Files:**
- Create: `lib/lab-engine/env.ts`
- Modify: `lib/generators/index.ts`, the 3 Rank 0 generators, `lib/lab-engine/lab-schema.ts` (`type: z.enum(["terminal", "packet"])`), `lib/progress/service.ts`, `lib/progress/challenge.ts`, `app/(app)/labs/[labId]/page.tsx`, `app/(app)/challenge/[rank]/page.tsx`, `components/labs/LabWorkspace.tsx`, `scripts/check-content.mts`, `tests/labs/helpers.ts`, `tests/unit/lib/progress/fakes.ts`
- Test: existing suites (refactor safety net) + `tests/unit/lib/lab-engine/env.test.ts`

**Interfaces:**
- Produces:
  - `type LabEnv = { kind: "terminal"; world: World } | { kind: "packet"; capture: Capture }` (`Capture` from Task 4's types file — create the type file in this task with the shapes from Task 4's Interfaces).
  - `GeneratorOutput = { env: LabEnv; answers: Record<string, string> }`.
  - `LabSession` and `ChallengeSession` carry `env: LabEnv` instead of `world`.
  - `assertEnvMatchesLab(lab, env)` — throws when `lab.type !== env.kind` (wired into `generateLab`).
  - `LabWorkspace` props: `env: LabEnv` (terminal → `TerminalLab`; packet → `PacketLab` from Task 5, rendered as "Coming in this phase" placeholder until Task 5).
  - Content gate: lessons whose lab is not a terminal lab run their console commands against `demoWorld()`.

- [ ] **Step 1: Failing test** `env.test.ts`: `generateLab` on a `type: packet` lab whose generator returns a terminal env throws `"lab x: generator returned terminal env for a packet lab"`.
- [ ] **Step 2:** Refactor to `env` everywhere; run `npm test`, `npm run check:content` and `npx playwright test tests/e2e/rank-0.spec.ts tests/e2e/lab-terminal.spec.ts` → all PASS (behaviour unchanged for Rank 0).
- [ ] **Step 3:** Commit `refactor(labs): environment-generic labs (terminal | packet)`.

---

### Task 4: Packet engine — capture model, display filters, follow stream

**Files:**
- Create: `lib/lab-engine/packet/types.ts`, `lib/lab-engine/packet/filter.ts`, `lib/lab-engine/packet/stream.ts`, `lib/lab-engine/packet/summary.ts`
- Test: `tests/unit/lib/lab-engine/packet/{filter,stream,summary}.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type Packet = { no: number; time: number /* s since start */; length: number; eth: { src: string; dst: string }; arp?: { op: "request" | "reply"; senderIp: string; targetIp: string; senderMac: string }; ip?: { src: string; dst: string; ttl: number; version: 4 | 6 }; icmp?: { type: number; code: number }; tcp?: { srcport: number; dstport: number; seq: number; ack: number; flags: { syn: boolean; ack: boolean; fin: boolean; rst: boolean; psh: boolean }; payload?: string }; udp?: { srcport: number; dstport: number }; dns?: { id: number; response: boolean; qname: string; qtype: string; rcode?: "NOERROR" | "NXDOMAIN"; answers?: { name: string; type: string; data: string; ttl: number }[] }; http?: { request?: { method: string; uri: string; host: string; headers: [string, string][]; body?: string }; response?: { code: number; phrase: string; headers: [string, string][]; body?: string } }; tls?: { handshake?: "ClientHello" | "ServerHello"; sni?: string; appData?: boolean } }`
  - `type Capture = { name: string; packets: Packet[] }` (≤ 3,000 packets).
- `summary.ts`: `protocolOf(p): "ARP"|"ICMP"|"DNS"|"HTTP"|"TLSv1.3"|"TCP"|"UDP"` (most specific layer) and `infoOf(p): string` in Wireshark's style — TCP `51514 → 443 [SYN] Seq=0 Win=64240 Len=0`, DNS `Standard query 0x1a2b A example.com` / `Standard query response 0x1a2b A example.com A 203.0.113.10` / `… No such name …`, HTTP `GET /login HTTP/1.1` / `HTTP/1.1 200 OK  (text/html)`, ARP `Who has 10.0.2.2? Tell 10.0.2.15` / `10.0.2.2 is at 52:55:0a:00:02:02`, TLS `Client Hello (SNI=example.com)`.
- `filter.ts`: `compileFilter(src: string): { ok: true; test(p: Packet): boolean } | { ok: false; error: string }`. Supported (Wireshark display-filter semantics):
  - protocol names alone: `arp icmp tcp udp dns http tls`
  - fields: `ip.src ip.dst ip.addr(src or dst) ip.ttl tcp.port(either) tcp.srcport tcp.dstport udp.port udp.srcport udp.dstport tcp.flags.syn tcp.flags.ack tcp.flags.fin tcp.flags.reset dns.qry.name dns.flags.response dns.a http.request.method http.request.uri http.host http.response.code tls.handshake.extensions_server_name frame.number`
  - operators `== != > < >= <= contains` (`contains` is case-sensitive substring), `and or not` and `&& || !`, parentheses, string literals in double quotes, numbers, IPv4 literals, booleans as `1`/`0`
  - `frame contains "text"` searches all string content of the packet (payload, headers, bodies, names)
  - errors (exact): `"=" is not a valid operator — use "=="`; `"<name>" is not a valid protocol or field`; `Unbalanced parentheses`; `Expected a value after "<op>"`; anything else `Invalid filter`
  - empty string → matches everything
- `stream.ts`: `followTcpStream(packets, packetNo): { client: string; server: string; text: string } | null` — the conversation (4-tuple) of that packet, payloads in order, client→server first; non-TCP → `null`.

- [ ] **Step 1: Failing tests:** each field/operator on a fixture capture (≈12 packets: ARP pair, DNS query/response, TCP handshake, HTTP POST + 200, TLS ClientHello, a RST); `ip.addr == 10.0.2.15 && tcp.port == 80`; `!dns`; `dns.qry.name contains "example"`; `frame contains "password"`; each exact error above (Review Focus #2); `""` matches all; `followTcpStream` returns the HTTP request+response text; performance — build 3,000 packets, `compileFilter('tcp.port == 80 and frame contains "x"')` over all < 50 ms (Review Focus #5); `infoOf` strings for each protocol.
- [ ] **Step 2:** Run → FAIL. Implement (hand-written tokenizer + recursive-descent parser → predicate). Run → PASS.
- [ ] **Step 3:** Commit `feat(packet): capture model, Wireshark-style display filters, follow TCP stream`.

---

### Task 5: Packet lab UI

**Files:**
- Create: `components/labs/packet/PacketLab.tsx` (client), `components/labs/packet/PacketTable.tsx`, `components/labs/packet/PacketDetails.tsx`, `components/labs/packet/StreamView.tsx`
- Modify: `components/labs/LabWorkspace.tsx` (render `PacketLab` for `env.kind === "packet"`)
- Test: `tests/unit/components/labs/PacketLab.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`compileFilter`, `infoOf`, `protocolOf`, `followTcpStream`), Task 3 (`LabEnv`).
- Produces: `<PacketLab capture />` — filter bar (input + Apply; Enter applies; invalid filter shows the error in `role="alert"` and keeps the last good list; filter input border pink when invalid), table columns **No. · Time · Source · Destination · Protocol · Length · Info** (`Time` with 6 decimals), row click selects and shows a details tree (one collapsible section per layer, field `name: value` lines in mono), "Follow TCP stream" button for TCP packets opens `StreamView` (client text cyan, server text pink, a "Back to packets" button), status line `Displayed: <shown> of <total> packets`. Keyboard: rows are buttons, arrow keys move selection. Mobile: table scrolls horizontally inside its own container; the page itself never scrolls sideways.

- [ ] **Step 1: Failing tests:** renders all packets and `Displayed: 12 of 12`; applying `dns` shows only DNS rows and `Displayed: 2 of 12`; invalid filter `ip.addr = 1.2.3.4` shows the exact error and still lists the previous rows; clicking an HTTP packet shows an `Hypertext Transfer Protocol` section; "Follow TCP stream" shows the request line.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(packet): packet lab UI — filter bar, packet list, details, follow stream`.

---

### Task 6: Networking lab generators, labs and solve tests

**Files:**
- Create: `lib/generators/network/base-network.ts` (seeded office network: learner host on `10.<a>.<b>.0/24` with random host part, gateway `.1`, resolver, 6–10 hosts using RFC 5737 public addresses and `.example` names), `lib/generators/network/ip-lab.ts`, `reach-lab.ts`, `web-lab.ts`, `lib/generators/packet/capture-builder.ts` (helpers emitting realistic packets: ARP, DNS q/r, TCP handshake/teardown, HTTP, TLS hello), `lib/generators/packet/scan-lab.ts`, `dns-lab.ts`, `http-lab.ts`; register all in `lib/generators/index.ts`; `labs/<id>/{lab.yaml,briefing.md}` ×6
- Test: `tests/labs/<lab-id>.test.ts` ×6, `tests/unit/lib/generators/capture-builder.test.ts`

**Labs** (all values seeded; `xp` 100 each unless noted; hints 2–3 per objective, last one names the command/filter, never the answer):

| Lab id | Type | Lesson | Objectives (answer key) |
|---|---|---|---|
| `core-r1-net-ip-lab-01` | terminal | IP & subnets | o1 your IPv4 address (`ip`), o2 default gateway (`gateway`), o3 how many usable host addresses on your subnet (`usable`, prefix /24–/28), o4 which interface is DOWN (`downIface`) |
| `core-r1-net-reach-lab-01` | terminal | MAC/ARP/ICMP | o1 which of the listed servers in `~/servers.txt` is unreachable (`unreachable`, name), o2 how many hops to `<target>` (`hops`), o3 the gateway's MAC (`gwMac`, case-insensitive) |
| `core-r1-net-web-lab-01` | terminal | HTTP/TLS | o1 the `Server` header of the intranet site (`server`), o2 where `http://<host>/` redirects (`redirect`, full URL), o3 flag in the body of `/admin/notes` (`flag`) |
| `core-r1-pkt-scan-lab-01` | packet | TCP/UDP/ports | o1 the scanning IP (`scanner`), o2 open ports found, ascending comma-separated (`openPorts`, e.g. `22,80,443`), o3 number of ports probed (`probed`) |
| `core-r1-pkt-dns-lab-01` | packet | DNS | o1 the domain that returned NXDOMAIN (`nxdomain`, case-insensitive), o2 the IP that `<name>` resolved to (`resolved`), o3 the host that sent the most DNS queries (`chatty`) |
| `core-r1-pkt-http-lab-01` | packet | Packet capture | o1 the username sent in the plain-HTTP login (`username`, case-sensitive), o2 the flag in the server's reply (`flag`), o3 the TLS server name (SNI) contacted right after (`sni`, case-insensitive) — xp 150 |

- [ ] **Step 1: Failing solve tests** — 5 seeds each, solving like a learner: terminal labs via `createShell(env.world)` commands (`ip a`, `ip route`, `cat ~/servers.txt` + `ping -c 1 …`, `traceroute`, `ip neigh`, `curl -I`, `curl -L`, `curl`); packet labs via `compileFilter` + reading `infoOf`/fields (`tcp.flags.syn == 1 && tcp.flags.ack == 0` to find the scanner and probes; `tcp.flags.syn == 1 && tcp.flags.ack == 1` for open ports; `dns.flags.response == 1` and `NXDOMAIN` in info; `http.request.method == "POST"` + `followTcpStream`; `tls.handshake.extensions_server_name`). Plus Review Focus #4: `checkObjective(dnsLab, answers, "o1", answer.toUpperCase())` true; `checkObjective(ipLab, answers, "o1", " " + ip + " ")` true; `ip + "."` false.
- [ ] **Step 2:** Run → FAIL. Implement builder + generators + yaml/briefings (briefings say the network is simulated and the learner is authorised to inspect it). Run → PASS. Captures stay ≤ 3,000 packets (assert in the builder test).
- [ ] **Step 3:** Commit `feat(labs): rank 1 networking labs (3 terminal, 3 packet) with solve tests`.

---

### Task 7: Networking lessons (draft content) + coverage

**Files:** `content/core/rank-1/NN-<slug>.mdx` + `.checks.yaml` ×9; modify `content/coverage/core.yaml`

| # | id | title | lab | Debrief incident (verify against primary sources while writing) |
|---|---|---|---|---|
| 1 | `core-r1-net-osi-01` | Layers: the OSI and TCP/IP Models | — (field exercise) | Facebook/Meta outage, 4 Oct 2021: a BGP change withdrew routes, which made its DNS unreachable |
| 2 | `core-r1-net-ip-01` | IP Addresses, Subnets and CIDR (IPv4 + IPv6) | `core-r1-net-ip-lab-01` | Capital One 2019: SSRF to the link-local metadata address 169.254.169.254 — why special addresses matter |
| 3 | `core-r1-net-l2-01` | MAC, ARP, Switches and ICMP | `core-r1-net-reach-lab-01` | "Ping of death" (1996–97): malformed oversized ICMP crashed many systems |
| 4 | `core-r1-net-tcpudp-01` | TCP, UDP and Ports | `core-r1-pkt-scan-lab-01` | GitHub, 28 Feb 2018: 1.35 Tbps memcached UDP amplification DDoS |
| 5 | `core-r1-net-dns-01` | DNS — The Internet's Phonebook | `core-r1-pkt-dns-lab-01` | MyEtherWallet, 24 Apr 2018: BGP hijack of Amazon Route 53 DNS servers |
| 6 | `core-r1-net-dhcp-nat-01` | DHCP and NAT | — (field exercise) | TunnelVision (CVE-2024-3661, May 2024): DHCP option 121 used to route traffic around VPNs |
| 7 | `core-r1-net-web-01` | HTTP, HTTPS and TLS | `core-r1-net-web-lab-01` | Heartbleed (CVE-2014-0160, April 2014) |
| 8 | `core-r1-net-routing-fw-01` | Routing, Firewalls and Proxies | — (field exercise) | Pakistan Telecom / YouTube BGP hijack, 24 Feb 2008 |
| 9 | `core-r1-net-capture-01` | Capturing and Reading Packets | `core-r1-pkt-http-lab-01` | Firesheep (2010): session cookies stolen from open Wi-Fi |

Rules: `track: core`, `rank: 1`, `module: networking`, `order` = #, `estimated_minutes` 25–40, `xp: 100`. ATT&CK where relevant: L4 T1046 Network Service Discovery, T1498.002 Reflection Amplification; L5 T1071.004 DNS, T1584.002 DNS Server; L7 T1557 Adversary-in-the-Middle; L8 T1090 Proxy; L9 T1040 Network Sniffing. Lesson 9 teaches the Wireshark display-filter subset the packet lab supports and shows `tcpdump` syntax only in a ```` ```text ```` block marked "on a real Linux machine (needs root)" — `tcpdump` is not a lab command. Lessons 4, 8 and 9 carry a short authorization note (scanning and sniffing only on networks you own or are permitted to test; IT Act s.43/66). Checks: 4 questions each.

Coverage additions (`target_rank: 1` unless noted; mark these new ids "verify" in the file header): `netplus:1.2` appliances/functions (firewalls, proxies), `netplus:1.7` IPv4 addressing, `netplus:1.8` modern environments incl. IPv6, `netplus:2.1` routing, `netplus:2.2` switching (MAC/ARP/VLAN basics), `netplus:3.5` network services (DHCP, DNS, NTP), `netplus:5.5` troubleshooting tools (ping, traceroute, dig, packet capture); `secplus:1.4` cryptographic solutions (TLS) `target_rank: 2`; `secplus:3.2` securing infrastructure (firewalls, proxies) `target_rank: 2`. Keep `built_ranks: [0]` until Rank 1 is complete (Plan 2C).

- [ ] **Step 1:** Write lessons 1–3 + checks; all `console` examples run against `demoWorld()` (capture real output with a scratch script before pasting); `npm run check:content` → PASS.
- [ ] **Step 2:** Lessons 4–6 + checks → PASS.
- [ ] **Step 3:** Lessons 7–9 + checks → PASS.
- [ ] **Step 4:** Commit `content(core): rank 1 networking lessons (draft, pending expert review)`.

---

### Task 8: End-to-end — rank gate and the Rank 1 networking journey

**Files:**
- Modify: `tests/e2e/rank-gate.spec.ts` (un-`fixme`), `tests/e2e/helpers/` (add `promoteToRank(page, n)` that drives the Rank 0 journey via the existing recipe module — extract the recipe functions from `rank-0.spec.ts` into `tests/e2e/helpers/rank0.ts`)
- Create: `tests/e2e/rank-1-networking.spec.ts`, `tests/e2e/helpers/packet.ts` (`applyFilter(page, filter)`, `rows(page)` → visible Info/Source/Destination texts)

- [ ] **Step 1: Write the tests** (desktop): a promoted operator sees `rank_1 · Operator` on the rank map with 9 networking lessons; opens lesson 4, answers its checks (`answerAllChecks`), opens the scan packet lab, applies `tcp.flags.syn == 1 && tcp.flags.ack == 1`, reads the open ports and the scanner from the rows, submits all three objectives, sees "Lab complete" and "Continue to next lesson: DNS — The Internet's Phonebook →". Mobile: a packet lab page has no horizontal page scroll (the table scrolls inside its own box).
- [ ] **Step 2:** `npm run test:e2e` → PASS. Full gate: `npm run lint && npm run typecheck && npm test && npm run check:content && npm run build` → all exit 0.
- [ ] **Step 3:** Commit `test(e2e): rank gate and rank 1 networking journey`.
- [ ] **Step 4:** Owner gate: the 9 networking lessons stay `draft` pending human expert review; list them in the final message.

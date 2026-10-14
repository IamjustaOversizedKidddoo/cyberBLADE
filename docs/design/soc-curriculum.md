# SOC L1 Curriculum: Plan (Phase 3, Prompt A)

**Status:** plan for owner approval. Two pilot lessons are written to full standard; everything else in this doc is an outline. All lessons are `status: draft` until a human expert reviews them. The agent may only set `review_status: draft | agent-checked`.

## 1. Purpose and boundaries

- **Goal:** take a beginner who has finished the core Rank 0–1 basics to the point where they can work every tool in the SOC simulator and show the practical skills expected of an entry-level SOC analyst.
- **Skills only.** Lessons never name certifications. The coverage file (`content/coverage/soc.yaml`) maps lessons to the simulator's own skill ids (`content/soc/skills.yaml`). Certification alignment stays at the level of "aligned with the published objectives of…" and only appears where official documents exist in the repo. None are there today, so no external objective ids are claimed.
- **No promises.** No job, pass or salary claims.
- **Reuse, don't duplicate.** Networking, Linux, Windows, web and crypto basics already exist in Ranks 0–2. L1 lessons link to them as prerequisites and spend their own words on the analyst's decision-making.
- **Additive.**
  - **Location:** new namespace `content/tracks/soc/l1/`, lesson ids `soc-l1-<module>-<slug>-NN`.
  - **Gating:** config only (`content/tracks/soc/l1/track.yaml`).
  - **Existing content:** core lessons are not renumbered and existing progress stays valid.

## 2. Lesson template (SOC L1)

The template merges the owner's SOC template with the binding teaching style (`docs/curriculum/teaching-style.md`). Sections, in order, are checked by `check:content`:

1. **Frontmatter:** `id`, `title`, `track: soc`, `rank` (from track config), `module`, `order`, `estimated_minutes` (must equal the computed time), `prerequisites` (lesson ids), `skills` (skill ids), `practice` (typed targets), `objectives_covered` (`soc:<skill>`), `mitre`, `xp`, `status: draft`, `review_status`, `last_reviewed: null`.
2. `> **Outcome:**` one line: what the learner can do afterwards.
3. `## Why this matters on shift`
4. `## Before you start`: prerequisites with links, plus "you do not need…".
5. `## Core ideas`: short `###` sections. Each concept follows: 5-second answer → why it exists → analogy, then the real meaning → how it works → diagram (`<FlowDiagram>`, which has a text alternative and works at 390 px and in forced colours).
6. `## Worked example`: step-by-step reasoning on separate synthetic data. It must include a dead end or a false lead.
7. `## Try it`: at least one `<MicroExercise>` on a small fixed dataset, checked on the server.
8. `## Common mistakes` and `## What good looks like`
9. `## In the real world`: tool *categories* (never vendors as endorsements) and what the simulator simplifies.
10. `## Remember it like this` and `## Interview answer`
11. `## Check your understanding`: `<TerminalCheck />` with at least 4 questions and a rationale on every option.
12. `## Key terms`: `<KeyTerms />`, which feeds the generated glossary.
13. `## Practice this`: `<PracticeThis />` cards built from frontmatter `practice`.

Flashcards live in `<lesson>.cards.yaml` next to the lesson and only hold facts the author is certain of. Exercises live in `<lesson>.exercises.yaml`; answer keys stay server-side.

**Computed time** = words ÷ 200 wpm (prose), plus 3 min per exercise, plus 1 min per check question, plus 0.5 min per diagram, rounded up. `npm run soc:curriculum:times` prints it, and the linter fails on any mismatch. Lessons over 15 minutes are flagged for splitting (a warning, so the owner decides).

## 3. Modules and lessons (42 lessons)

`P` = prerequisites (core lessons by id, or earlier L1 lessons by number). Practice target kinds: `drill:` BladeQL drill, `family:` scenario family lab, `shift:` shift profile, `tool:` enrichment tool, `report:` report section.

| # | Module | Lesson (slug) | P | Skills | Practice |
|---|---|---|---|---|---|
| 1 | M1 SOC foundations | What a SOC does and who works there (`soc-roles`) | core-r0-mind-attacker-defender-01, core-r0-career-ethics-law-01 | soc_alert_triage | shift:shift-quiet-day |
| 2 | M1 | The life of an alert (`alert-lifecycle`) | 1 | soc_alert_triage, soc_case_management | family:soc-f-alert-fatigue-01 |
| 3 | M1 | Handling data ethically on shift (`data-handling`) | 1 | soc_documentation, soc_insider_policy | family:soc-f-insider-policy-01 |
| 4 | M2 Alert triage | Anatomy of an alert (`alert-anatomy`) | 2 | soc_alert_triage | family:soc-f-mixed-signal-01 |
| 5 | M2 | **PILOT: The triage loop (`triage-loop`)** | 4 | soc_alert_triage, soc_false_positive_id | family:soc-f-mixed-signal-01, shift:shift-quiet-day, report:verdict_and_severity |
| 6 | M2 | Prioritising: severity, impact and asset criticality (`prioritisation`) | 5 | soc_alert_triage, soc_scope_assessment | tool:cmdb, shift:shift-alert-storm |
| 7 | M2 | False positives, benign true positives and duplicates (`dispositions`) | 5 | soc_false_positive_id | family:soc-f-alert-fatigue-01 |
| 8 | M2 | Writing rationales and knowing when to escalate (`rationale-escalation`) | 7 | soc_escalation_handoff, soc_documentation | report:escalation_handoff |
| 9 | M3 Detection | How attacks unfold: a stage model for defenders (`attack-stages`) | 5, core-r2-security-arch-01 | soc_scope_assessment | family:soc-f-attachment-script-01 |
| 10 | M3 | ATT&CK as a shared vocabulary (`attack-vocabulary`) | 9 | soc_threat_intel | report:technique_mapping |
| 11 | M3 | Detection types and telemetry blind spots (`detection-blind-spots`) | 10 | soc_siem_correlation | shift:shift-night-telemetry-gaps |
| 12 | M4 Phishing | How email travels (`how-email-travels`) | core-r1-net-dns-01, core-r1-net-tcpudp-01 | soc_phishing_analysis | tool:email_headers |
| 13 | M4 | **PILOT: Reading email headers (`header-analysis`)** | 12 | soc_phishing_analysis | tool:email_headers, family:soc-f-phishing-cred-01 |
| 14 | M4 | Links, attachments and impersonation (`links-attachments`) | 13 | soc_phishing_analysis, soc_malware_triage | tool:url_analysis, tool:sandbox |
| 15 | M4 | Triage and containment of a phishing report (`phishing-response`) | 14, 8 | soc_phishing_analysis, soc_incident_response | family:soc-f-phishing-cred-01 |
| 16 | M5 Network | Flow records vs packets (`flow-vs-packet`) | core-r1-net-capture-01 | soc_network_traffic | tool:pcap_flows |
| 17 | M5 | DNS, HTTP and TLS through a defender's eyes (`dns-http-tls`) | 16, core-r1-net-web-01 | soc_network_indicators | tool:pdns, drill:drill-06 |
| 18 | M5 | Beaconing, scanning and unusual egress (`beacon-scan-egress`) | 17 | soc_network_indicators, soc_data_exfiltration | family:soc-f-outbound-exfil-01, drill:drill-20 |
| 19 | M5 | Proxy and firewall logs (`proxy-firewall-logs`) | 16, core-r1-net-routing-fw-01 | soc_network_monitoring | drill:drill-16 |
| 20 | M6 Endpoint | Windows sign-in events (`windows-auth-events`) | core-r1-win-logs-sysmon-01 | soc_windows_logs, soc_credential_attacks | family:soc-f-brute-force-auth-01 |
| 21 | M6 | Process creation and command lines (`process-creation`) | 20, core-r1-win-proc-services-01 | soc_endpoint_triage | tool:endpoint_timeline |
| 22 | M6 | Persistence: tasks, services, run keys and cron (`persistence`) | 21, core-r1-linux-services-01 | soc_endpoint_triage | family:soc-f-attachment-script-01 |
| 23 | M6 | Timelines and process trees (`timelines-trees`) | 21 | soc_endpoint_triage, soc_scope_assessment | tool:endpoint_timeline, report:timeline |
| 24 | M6 | Living-off-the-land: when normal tools do abnormal things (`lotl`) | 23 | soc_endpoint_triage | family:soc-f-attachment-script-01 |
| 25 | M6 | Linux host telemetry (`linux-telemetry`) | core-r1-linux-investigate-01 | soc_linux_logs | drill:drill-12 |
| 26 | M7 Web and identity | Web and proxy logs: blocked vs successful (`web-logs`) | core-r2-http-protocol-01, core-r2-sqli-01 | soc_web_log_analysis, soc_web_attacks | family:soc-f-web-attack-data-01 |
| 27 | M7 | Password guessing and spraying (`credential-attacks`) | 20 | soc_credential_attacks | family:soc-f-brute-force-auth-01, drill:drill-14 |
| 28 | M7 | Impossible travel and MFA fatigue (`impossible-travel-mfa`) | 27 | soc_credential_attacks, soc_cloud_identity | family:soc-f-cloud-identity-01 |
| 29 | M7 | Cloud sign-in and audit logs (`cloud-logs`) | 28 | soc_cloud_identity | family:soc-f-cloud-identity-01 |
| 30 | M8 Malware and intel | Malware behaviour in telemetry and sandbox reports (`malware-behaviour`) | 24 | soc_malware_triage | tool:sandbox |
| 31 | M8 | Hashes, reputation and conflicting sources (`reputation`) | 30, core-r2-crypto-pki-01 | soc_threat_intel | tool:reputation, tool:whois |
| 32 | M8 | IOCs vs behaviours and the enrichment workflow (`enrichment-workflow`) | 31 | soc_threat_intel, soc_malware_triage | tool:pdns, tool:tickets |
| 33 | M9 SIEM | Normalisation and thinking in queries (`thinking-in-queries`) | 4 | soc_siem_correlation | drill:drill-01, drill:drill-02 |
| 34 | M9 | From search to stats and timechart (`stats-timechart`) | 33 | soc_siem_correlation | drill:drill-12, drill:drill-15 |
| 35 | M9 | Sessions and correlation (`sessions-correlation`) | 34 | soc_siem_correlation | drill:drill-20 |
| 36 | M9 | Hunting and validating hypotheses (`hunting`) | 35 | soc_siem_correlation, soc_scope_assessment | drill:drill-17, shift:shift-standard-mixed |
| 37 | M10 Incident response | The incident lifecycle and containment trade-offs (`ir-lifecycle`) | 15 | soc_incident_response | report:response_actions |
| 38 | M10 | Evidence, communication and the escalation handoff (`evidence-handoff`) | 37, 8 | soc_escalation_handoff, soc_case_management | report:escalation_handoff |
| 39 | M11 Reporting | Report anatomy, timelines and IOC tables (`report-anatomy`) | 38 | soc_documentation | report:timeline, report:indicators_of_compromise |
| 40 | M11 | Summaries and handoffs under time pressure (`report-summaries`) | 39 | soc_documentation, soc_escalation_handoff | report:executive_summary |
| 41 | M12 Working the shift | Queue, time and handover (`queue-handover`) | 6, 8 | soc_alert_triage, soc_case_management | shift:shift-alert-storm |
| 42 | M12 | Judgment, sustainability and honest career orientation (`judgment-career`) | 41 | soc_alert_triage | shift:shift-standard-mixed |

**Prerequisite changes during Part 4 (2026-10-14):** the track gate is Rank 1, so a Rank 1 learner cannot open Rank 2 core lessons. Lessons 9, 26 and 31 therefore use Rank 0–1 core prerequisites instead of `core-r2-*`. Lesson 9 uses `core-r0-mind-attacker-defender-01`. Lesson 26 uses `core-r1-net-web-01` and `core-r1-net-routing-fw-01`. Lesson 31 uses `core-r0-comp-os-files-01`; no Rank 0–1 lesson teaches file hashing, so lesson 31 teaches it itself. The pilot triage loop (5) now depends on lesson 4, as planned.

**Drill remapping during Part 4 (2026-10-15):** the planned `drill:` targets were checked against what each drill actually practises (`lib/lab-engine/soc/query/drills.ts`). Several did not match: drill 06 searches command lines for `-enc`, drill 16 ranks processes, drill 20 rebuilds sign-in sessions, and drill 12 counts sign-ins by outcome. They are remapped as follows:
- Lesson 17 has no drill (DNS is not in the drill dataset).
- Lesson 18 uses `tool:pcap_flows`.
- Lesson 19 uses drills 03 and 07 (firewall action and bytes).
- Lesson 21 uses drills 04 and 06; lesson 24 uses drill 06.
- Lesson 25 practises with `lesson:core-r1-linux-investigate-01`, because the drill dataset has no Linux logs.
- Lesson 27 uses drills 12 and 14.

**Module adjustments vs the brief** (with reasons):
- M2 has five lessons instead of four, because triage is the core L1 skill.
- M6 adds a Linux lesson. Linux hosts are in the simulator.
- M10, M11 and M12 have two lessons each, because the report and shift mechanics are practised in the simulator rather than read about.
- Total: 42 lessons, inside the 36–44 range.

## 4. Skills coverage matrix

| Skill (`content/soc/skills.yaml`) | Taught in | Practised in | Gap |
|---|---|---|---|
| soc_alert_triage | 1, 2, 4, 5, 6, 41, 42 | all families, shifts | — |
| soc_false_positive_id | 5, 7 | alert-fatigue family, shifts | — |
| soc_phishing_analysis | 12–15 | phishing family, email_headers tool | — |
| soc_credential_attacks | 20, 27, 28 | brute-force, cloud-identity families | — |
| soc_endpoint_triage | 21–24 | attachment-script family, endpoint_timeline tool | — |
| soc_network_indicators | 17, 18 | outbound-exfil family, pdns tool | — |
| soc_network_traffic | 16 | pcap_flows tool | thin: no packet-heavy family |
| soc_network_monitoring | 19 | drills | thin |
| soc_web_attacks / soc_web_log_analysis | 26 | web-attack family | — |
| soc_data_exfiltration | 18 | outbound-exfil family | — |
| soc_insider_policy | 3 | insider-policy family | thin: one lesson |
| soc_cloud_identity | 28, 29 | cloud-identity family | — |
| soc_windows_logs | 20 | brute-force family | — |
| soc_linux_logs | 25 | drills only | **gap**: no Linux-centred family |
| soc_malware_triage | 14, 30, 32 | sandbox tool, attachment family | — |
| soc_threat_intel | 10, 31, 32 | reputation/whois tools | — |
| soc_siem_correlation | 11, 33–36 | 20 drills, query questions | — |
| soc_scope_assessment | 6, 9, 23, 36 | report scoping | — |
| soc_escalation_handoff | 8, 38, 40 | report handoff section | — |
| soc_documentation | 3, 8, 39, 40 | report editor | — |
| soc_incident_response | 15, 37 | report actions | — |
| soc_case_management | 2, 38, 41 | cases in workspace | — |

"Covered" in `content/coverage/soc.yaml` means **taught AND practised**. The gaps are listed there as well and are not hidden.

## 5. Prerequisite graph rules

- No cycles. No term may be used before the lesson that defines it; the linter checks key terms against first-definition order.
- L1 lessons may depend on core lessons. Core lessons never depend on L1 lessons.
- Track gating: `track.yaml` holds `min_core_rank: 1`. Each lesson's `rank` must equal it (linter rule). The existing `canAccessRank` check then applies unchanged.

## 6. Tone guide (L1)

- Calm and practical. Write in second person ("you"); the learner is a new analyst on their first shifts.
- Explain the *decision*, not the tool's buttons. Tools are named by category ("an email security gateway", "an EDR agent"), never as vendor endorsements.
- Every worked example includes something that *looked* suspicious and was not, or a check that led nowhere.
- Synthetic world for lessons only:
  - **Organisation:** fictional "Larkspur Freight" (`larkspur.example`).
  - **External addresses:** `192.0.2.0/24`, a documentation range the scenario generator never uses.
  - **Internal addresses:** `172.16.40.0/24`.
  - **Other data:** fictional people, `.example` / `.test` / `.invalid` domains and made-up hashes.

  A leak scan proves lessons share no indicators with the scenario generator's vocabulary or family files.
- Uncertain facts are generalised and logged in `docs/ops/soc-curriculum-claims.md`, never guessed.

## 7. What gets built besides lessons (Part 4, after approval)

- Module checkpoints: 20–30 questions drawn from a larger bank, formative, with XP that is idempotent and capped per the existing rules.
- A generated glossary with first-use tooltips.
- Practice paths (phishing, brute force, endpoint triage, first full shift) with computed times.
- The coverage file, and the full linter rule set.
- Track pages: landing and curriculum map, module pages, mastery view.
- Tests: exercise checkers with variants, keyboard-only E2E, axe, Lighthouse.

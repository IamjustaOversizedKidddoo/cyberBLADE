# Phase 2C — Rank 1 · Windows & PowerShell + Capstone Challenge Implementation Plan

**Branch:** `phase-2c-windows-challenge`  
**Dependencies:** Phase 2A (Networking), Phase 2B (Linux) merged on `main`  
**Date:** 2026-10-10  
**Status:** In Progress

---

## 1. Overview & Objectives

Phase 2C completes **Rank 1 (Operator)** by delivering:
1. **Windows & PowerShell Virtual Environment**: A lightweight, deterministic in-browser PowerShell simulation supporting key administrative cmdlets, Windows Registry navigation (`HKLM:\`, `HKCU:\`), Windows Event Log querying (`Get-WinEvent`), and services/processes inspection.
2. **Two Rank 1 Windows Labs**:
   - `core-r1-win-registry-lab-01`: Registry Auto-Start Execution Point (ASEP) Persistence Hunt (`T1547.001`).
   - `core-r1-win-eventlog-lab-01`: Windows Event Log Analysis — Password Spraying & Service Creation (`T1110.003`, `T1543.003`).
3. **Four Rank 1 Windows Lessons (Orders 17–20)**:
   - Order 17: `core-r1-win-arch-01` — Windows Architecture, Filesystem and the Registry
   - Order 18: `core-r1-win-ps-01` — PowerShell Fundamentals & Administration
   - Order 19: `core-r1-win-proc-01` — Windows Processes, Services and Scheduled Tasks
   - Order 20: `core-r1-win-logs-01` — Windows Event Logs, Sysmon and Host Triage
4. **Rank 1 Capstone Challenge (`core-r1-challenge-01`)**:
   - Timed multi-objective incident response challenge (30 min) spanning Network analysis, Linux forensic artifacts, and Windows event logs.
   - Successful completion promotes the operator from **Rank 1 (Operator)** to **Rank 2 (Watcher)**.

---

## 2. Technical Architecture & File Layout

### 2.1 Virtual Windows & PowerShell Simulation
- `lib/lab-engine/terminal/windows/`:
  - `registry.ts`: Virtual Windows Registry hive (`HKLM`, `HKCU`) with properties, keys, and values.
  - `eventlog.ts`: Virtual Windows Event Log engine (Security, System, Sysmon channels with Event IDs 4624, 4625, 7045, 4688, Sysmon 1).
  - `services.ts`: Windows services (`Get-Service`, `Start-Service`, `Stop-Service`).
  - `scheduled-tasks.ts`: Windows scheduled tasks (`Get-ScheduledTask`).
- `lib/lab-engine/terminal/commands/powershell/`:
  - `get-childitem.ts`: `Get-ChildItem` (aliases: `gci`, `dir`, `ls`) with `-Path`, `-Recurse`, `-Force`.
  - `get-content.ts`: `Get-Content` (aliases: `gc`, `cat`, `type`) with `-Path`, `-Tail`, `-TotalCount`.
  - `select-string.ts`: `Select-String` (alias: `sls`) with `-Pattern`, `-Path`.
  - `get-process.ts`: `Get-Process` (aliases: `gps`, `ps`) and `Stop-Process` (`spps`, `kill`).
  - `get-service.ts`: `Get-Service` (alias: `gsv`).
  - `get-itemproperty.ts`: `Get-ItemProperty` (alias: `gp`) and `Get-Item` (`gi`) for Registry paths (`HKLM:\...`, `HKCU:\...`).
  - `get-winevent.ts`: `Get-WinEvent` / `Get-EventLog` with `-LogName`, `-FilterHashtable`, `-ListLog`.
  - `get-scheduledtask.ts`: `Get-ScheduledTask`.
  - Extended `whoami.ts`: Supporting Windows `/priv`, `/groups`, `/all`.

### 2.2 Labs & Generators
- `lib/generators/windows/`:
  - `registry-lab.ts`: Generates a Windows host with standard services, benign run keys, and one seeded malicious run key (`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` or `HKCU:\...`).
  - `eventlog-lab.ts`: Generates security logs containing realistic background activity plus an anomalous brute-force / password spray attack and rogue service creation.
- `lib/generators/challenge/`:
  - `rank1-challenge.ts`: Comprehensive multi-stage challenge dataset (Packet capture + Linux machine + Windows artifacts).
- Lab definitions:
  - `labs/core-r1-win-registry-lab-01/{lab.yaml,briefing.md}`
  - `labs/core-r1-win-eventlog-lab-01/{lab.yaml,briefing.md}`
  - `labs/core-r1-challenge-01/{lab.yaml,briefing.md}`

### 2.3 Lessons & Checks
- `content/core/rank-1/`:
  - `17-win-arch-registry.mdx` + `17-win-arch-registry.checks.yaml`
  - `18-win-powershell.mdx` + `18-win-powershell.checks.yaml`
  - `19-win-proc-services.mdx` + `19-win-proc-services.checks.yaml`
  - `20-win-logs-sysmon.mdx` + `20-win-logs-sysmon.checks.yaml`

---

## 3. Step-by-Step Task Breakdown

### Task 1: Windows Registry & Event Log Engine
- Implement `lib/lab-engine/terminal/windows/registry.ts` and `eventlog.ts`.
- Write unit tests for registry traversal and event filtering.

### Task 2: PowerShell Cmdlet Suite
- Implement `Get-ItemProperty`, `Get-WinEvent`, `Get-Service`, `Get-Process`, `Select-String`, and `whoami /priv`.
- Integrate aliases (`gci`, `gc`, `sls`, `gsv`, `gps`, `gp`).
- Write unit tests covering pipeline and argument parsing.

### Task 3: Windows World Models & Generators
- Implement `windowsBaseWorld()` in `lib/generators/terminal/windows-world.ts`.
- Implement `registryLab` and `eventlogLab` generators.
- Write lab property tests over 1,000 seeds (`tests/labs/core-r1-win-registry-lab-01.test.ts`, `tests/labs/core-r1-win-eventlog-lab-01.test.ts`).

### Task 4: Windows Lessons (Orders 17–20) & Content Validation
- Author Lessons 17, 18, 19, 20 with exact output matching.
- Author `.checks.yaml` files (4 questions each).
- Update `content/coverage/core.yaml` and verify `npm run check:content`.

### Task 5: Rank 1 Capstone Challenge Lab
- Implement `core-r1-challenge-01` (`challenge: true`, 30 min timer).
- Wire promotion handler for Rank 1 → Rank 2 transition.
- Verify challenge solver across seeds.

### Task 6: End-to-End Tests & Gates
- Add `tests/e2e/rank-1-windows.spec.ts` and `tests/e2e/rank-1-challenge.spec.ts`.
- Execute full verification gates: `lint`, `typecheck`, `check:content`, `test`, `build`, `test:e2e`.
- Merge into local `main`.

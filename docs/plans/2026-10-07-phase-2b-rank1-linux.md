# Phase 2B — Rank 1 · Linux (identity, permissions, processes, services + 7 lessons + 3 labs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Rank 1 operator can study the Linux module — 7 lessons and 3 seeded terminal labs (permissions puzzle, process hunt, SUID/sudo audit) — in a simulated Linux machine that now has real users and groups, group-aware permissions, special permission bits, processes with `/proc`, systemd services and sudo rules.

**Architecture:** Same shape as Phase 1/2A: pure-TS engine in `lib/lab-engine/terminal/`, one command per file, seeded generators in `lib/generators/linux/`, answers checked on the server by regenerating from the hidden seed, lessons as MDX + checks YAML behind `npm run check:content` (which now also requires every shown console output to match `demoWorld()` exactly). Identity comes from the machine's own `/etc/passwd`, `/etc/group` and `/etc/sudoers` files in the VFS, so what lessons teach about those files is literally how the simulation works. Processes and services are new optional parts of `World`; `/proc` is generated from the process list.

**Tech Stack:** Phase 1 stack only. No new runtime dependencies.

**Spec:** `docs/specs/2026-10-06-platform-design.md` (§6 Rank 1 item 2 "Linux fundamentals (filesystem, users/groups, permissions, SUID/SGID, processes, services/systemd, cron, SSH, bash, logs, host investigation)", §7 lab engine, §14 Phase 2). Also `CLAUDE.md`, `docs/curriculum/teaching-style.md` (binding), `docs/curriculum/blade-roadmap.md` (Week 2: Linux Fundamentals), `docs/curriculum/cert-targets.md`. Builds on `docs/plans/2026-10-07-phase-2a-rank1-networking.md`.

**Phase 2 split (owner decision 2026-10-07):** 2A Networking (done) → **2B Linux (this plan)** → 2C Windows/PowerShell + Rank 1 challenge → Handler (Groq + Gemini) → exam-readiness engine → achievements/streaks → Rank 2 → hosted foundation last, before beta.

## Global Constraints

- Local-first; no network calls from any command or test (the simulated network from 2A is the only "network"). Git stays local: merge into local `main`, never push.
- Rank gate: all new lessons and labs are `rank: 1`; server-side gate from 2A applies unchanged.
- Lessons: full CLAUDE.md template, `teaching-style.md` (binding), `status: draft`, `last_reviewed: null`, exactly 4 checks each (basic, conceptual, practical, security/scenario), explanation for every option, ≥1 coverage objective per question, original text only.
- Every ```` ```console ```` example must run in the lab shell **and** its shown output must equal what `demoWorld()` prints (content gate). Commands that need a real machine (e.g. `sudo systemctl restart`, `crontab -e`, `journalctl`) appear only in ```` ```text ```` blocks marked "on a real Linux machine".
- Security material is defensive at Rank 1: auditing, detection and hardening. SUID/sudo content teaches how to *find and fix* risky configurations, not how to exploit them; ATT&CK IDs name the technique defenders look for. Lessons that show attacker technique carry the authorization note (systems you own or have written permission to test; IT Act s.43/66).
- Output and error wording match real tools: GNU coreutils 9.4 (`chmod`, `chown`, `chgrp`, `id`, `groups`, `env`, `tr`, `uname`), GNU findutils 4.9 (`find`), procps-ng 4.0 (`ps`, `pgrep`), bash 5.2 builtins (`kill`, `export`, `unset`, `umask`), systemd 255 (`systemctl`), sudo 1.9 — as on Ubuntu 24.04. Where the lab cannot do what the real tool does (password prompts, changing services), it prints a one-line lab message in the style of 2A's `ping` ("…this lab …").
- Determinism: no wall-clock time in output. Fixed "now" = `Wed 2026-10-07 10:00:00 IST` (same as 2A's `dig`); process and service start times come from the world.
- Example data: RFC 5737 / RFC 1918 addresses, `.example` names, usernames from `USERNAMES`; never real third-party hosts.
- Every lab has a learner-style solve test over `SEEDS` (≥5) **and** a property test over `MANY_SEEDS` (1,000) asserting each answer is unique/unambiguous and the lab is solvable (lesson learned in 2A's review).
- Answer keys never reach the browser; the world does (as in Phase 1), so answers must require using the tools, not reading a JSON field name like `answer`.
- One command per file in `lib/lab-engine/terminal/commands/`; small focused files; tests first.
- Commit messages end with the session's attribution line.

## Review Focus

1. A learner tries to change what they don't own — `chmod`/`chown` on a root file, `kill` of a root process, `sudo` for a command not in their rules, `chgrp` to a group they're not in → the real tool's error wording, exit code 1, and nothing changes. Tests in Tasks 2, 4, 5.
2. `find /` as a normal user → "Permission denied" lines on stderr, matches still on stdout, exit code 1; `2>/dev/null` hides only the noise; `2>&1 | grep` sees both. Test in Task 3.
3. Mode edge cases — `chmod 4755`, `chmod u+s,g-w`, `chmod +x` under `umask 077`, `chmod 0644` on a SUID file clears the bit, invalid modes (`chmod 9 f`, `chmod u+q f`, `chmod 8755 f`) → exact GNU results/errors; `ls -l` shows `s`/`S`/`t`/`T` correctly. Tests in Tasks 1, 2.
4. `kill` of the learner's own shell, PID 1, a PID that doesn't exist, or a non-number → no crash and bash's exact messages; a killed process disappears from `ps` and `/proc` at once. Test in Task 4.
5. State-changing builtins in a pipeline or redirect (`export X=1 | cat`, `sudo -l > f`, `umask 077 | cat`) → behave like bash (a pipeline runs in a subshell: no lasting effect), and every `sudo` use — allowed or refused — is appended to `/var/log/auth.log`. Tests in Tasks 3, 5.

---

### Task 1: Identity and the permission model (users, groups, special bits, umask)

**Files:**
- Create: `lib/lab-engine/terminal/identity.ts`, `lib/lab-engine/terminal/commands/id.ts`, `commands/groups.ts`
- Modify: `lib/lab-engine/terminal/vfs.ts`, `types.ts` (`World.umask?: number`), `commands/index.ts`, `commands/simple.ts` (`whoami` reads the effective user), `commands/ls.ts` (special bits via `formatMode`), `lib/lab-engine/terminal/demo-world.ts`, `lib/generators/terminal/base-world.ts` (both gain `/etc/group`; demo `/tmp` becomes `0o1777`)
- Test: `tests/unit/lib/lab-engine/terminal/identity.test.ts`, `vfs.test.ts` (extend), `commands/id.test.ts`, `commands/groups.test.ts`, `commands/ls.test.ts` (extend)

**Interfaces:**
- Produces (`identity.ts`):
  - `type Account = { name: string; uid: number; gid: number; home: string; shell: string }`
  - `type Group = { name: string; gid: number; members: string[] }`
  - `readAccounts(vfs: Vfs): Account[]`, `readGroups(vfs: Vfs): Group[]` — parse `/etc/passwd` and `/etc/group` via `vfs.stat` (no permission check; the OS itself reads them). Missing file → `[]`.
  - `groupsOf(vfs: Vfs, user: string): string[]` — primary group first, then supplementary groups in `/etc/group` order; root → `["root"]` plus memberships.
- `Vfs` changes: permission check becomes owner bits → group bits (if `groupsOf(user)` includes `node.group`) → other bits; root bypasses read/write, and execute needs any x bit (for dirs root always may search). `new Vfs(root, { umask })`; new files get `0o666 & ~umask`, new dirs `0o777 & ~umask`; default umask `0o022` (keeps all existing outputs). Add `vfs.setMode(path, mode)`, `vfs.setOwner(path, owner?, group?)` (raw, callers check rights).
- `formatMode` handles `0o4000` (owner `s`/`S`), `0o2000` (group `s`/`S`), `0o1000` (other `t`/`T`).
- `id [user]`: `uid=1000(learner) gid=1000(learner) groups=1000(learner),27(sudo)`; unknown user → `id: 'bob': no such user` code 1. `groups [user]`: own → `learner sudo`; named → `bob : bob docker`.
- `/etc/group` for `demoWorld()`: `root:x:0:`, `adm:x:4:`, `sudo:x:27:learner`, `shadow:x:42:`, `www-data:x:33:`, `learner:x:1000:`. `baseWorld()` adds the same system groups plus one group per user.

- [ ] **Step 1: Failing tests.** `identity.test.ts`: parse fixture passwd/group; `groupsOf` order; a user in `/etc/group` member list gains that group. `vfs.test.ts`: a `0o640 root:adm` file is readable by a member of `adm` and not by others; `0o604` file: group member who is not the owner gets *group* bits (none) even though other has `r` (Linux checks the first matching class only); umask `0o077` → new file `0o600`, new dir `0o700`. `ls.test.ts`: modes `0o4755` → `-rwsr-xr-x`, `0o4644` → `-rwSr--r--`, `0o2755` → `-rwxr-sr-x`, `0o1777` dir → `drwxrwxrwt`, `0o1776` → `drwxrwxrwT`. `id`/`groups` exact strings above, unknown user error.
- [ ] **Step 2:** Run → FAIL. Implement. Run `npm test` → PASS, including every Rank 0 / 2A lab solve test (the group model must not change their answers).
- [ ] **Step 3:** `npm run check:content` → the gate reports the Rank 0 lesson 2 `ls -l /etc` example (now one more line, `group`) and any `/tmp` listing; regenerate those shown outputs from the engine. → PASS.
- [ ] **Step 4:** Commit `feat(terminal): users, groups, group-aware permissions, special bits and umask`.

---

### Task 2: Permission commands — chmod, chown, chgrp, umask

**Files:**
- Create: `lib/lab-engine/terminal/commands/chmod.ts`, `chown.ts` (exports `chown` and `chgrp`), `umask.ts`, `lib/lab-engine/terminal/modes.ts`
- Modify: `commands/index.ts`, `lib/lab-engine/terminal/shell.ts` (mutable umask passed to `Vfs`)
- Test: `tests/unit/lib/lab-engine/terminal/modes.test.ts`, `commands/chmod.test.ts`, `commands/chown.test.ts`, `commands/umask.test.ts`

**Interfaces:**
- Produces (`modes.ts`): `parseMode(spec: string, current: number, opts: { isDir: boolean; umask: number }): number | null` — octal `[0-7]{1,4}` or symbolic `[ugoa]*[+-=][rwxXst]*` comma-separated; `X` = execute only if dir or already executable by someone; no who-letters ⇒ like `a` but bits set in umask are left alone. A numeric mode with < 4 digits on a *file* clears setuid/setgid; on a *directory* it keeps them (GNU behaviour). `null` = invalid.
- `CmdContext` gains `umask: number` and `setUmask(n: number)`.
- Pinned behaviour:
  - `chmod [-R] MODE FILE…`; only owner or root. Errors: `chmod: cannot access 'x': No such file or directory`; `chmod: changing permissions of 'x': Operation not permitted`; `chmod: invalid mode: 'u+q'` + `Try 'chmod --help' for more information.`; missing operand `chmod: missing operand`. Exit 1 on any failure, other files still processed.
  - `chown [-R] USER[:GROUP] FILE…` and `chown :GROUP FILE`: only root (Linux rule). Non-root → `chown: changing ownership of 'x': Operation not permitted`. Unknown user `chown: invalid user: 'bob'`; unknown group `chown: invalid group: 'learner:nogroup'`. Changing the owner of a non-dir clears setuid/setgid.
  - `chgrp [-R] GROUP FILE…`: owner who is a member of GROUP, or root. Else `chgrp: changing group of 'x': Operation not permitted`; unknown `chgrp: invalid group: 'x'`.
  - `umask` → `0022`; `umask -S` → `u=rwx,g=rx,o=rx`; `umask 077` sets; `umask u=rwx,g=,o=` sets; invalid → `bash: umask: 9: octal number out of range` code 1. Only takes effect when `alone` (a pipeline is a subshell).

- [ ] **Step 1: Failing tests.** `modes.test.ts`: table of (spec, current, isDir, umask) → result, covering every bullet above incl. Review Focus #3 (`4755`, `u+s,g-w`, `+x` under umask `077` → only `u+x`, `0644` on a `4755` file → `0644`, `755` on a `2755` dir → `2755`, `9`, `8755`, `u+q`, `a=` , `go-rwx`, `u=rw,g=r,o=`, `X` on dir vs non-executable file). Command tests: learner chmods own file; chmod on `/etc/passwd` → exact error and mode unchanged; `-R` on a tree; chown as learner fails, as root (via a root-user world) succeeds and clears SUID; chgrp to own group vs a group not a member of; umask then `touch` → `-rw-------`; `umask 077 | cat` leaves umask at `0022`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(terminal): chmod, chown, chgrp and umask`.

---

### Task 3: Shell growth — stderr redirects, /dev/null, env/export/unset, find, tr, uname

**Files:**
- Create: `lib/lab-engine/terminal/commands/env.ts` (exports `env`, `exportCmd` named `export`, `unset`), `find.ts`, `tr.ts`, `uname.ts`, `lib/lab-engine/terminal/sysinfo.ts` (fixed kernel/CPU/memory facts shared with Task 4's `/proc`)
- Modify: `lib/lab-engine/terminal/parser.ts`, `shell.ts`, `commands/index.ts`, `demo-world.ts` (adds `/dev/null`)
- Test: `tests/unit/lib/lab-engine/terminal/parser.test.ts` (extend), `shell.test.ts` (extend), `commands/env.test.ts`, `commands/find.test.ts`, `commands/tr.test.ts`, `commands/uname.test.ts`

**Interfaces:**
- Parser: `redirect?: { op: ">" | ">>"; path }` becomes `redirects: { fd: 1 | 2; op: ">" | ">>"; path: string }[]` plus `stderrToStdout?: boolean` for `2>&1`. Accepted: `> f`, `>> f`, `2> f`, `2>> f`, `2>&1`, in any order after the command; `2>&1` applies at its position (bash order rule: `cmd > f 2>&1` sends both to f; `cmd 2>&1 > f` sends stderr to the terminal). Writing to `/dev/null` discards; reading it gives `""`. `isTty`/`alone` keep their meaning (any stdout redirect ⇒ not a tty).
- `sysinfo.ts` produces `KERNEL = { release: "6.8.0-45-generic", version: "#45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024", machine: "x86_64" }` and the exact `/proc/version`, `/proc/cpuinfo` (2 processors, "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz"), `/proc/meminfo` (first 5 lines, 4 GB machine) texts.
- Pinned behaviour:
  - `env` prints `NAME=value` lines in insertion order; with arguments → `env: this lab only runs env with no arguments` code 1.
  - `export NAME=value`, `export NAME`, `export`/`export -p` → `declare -x NAME="value"` sorted by name; bad name → ``bash: export: `1x=y': not a valid identifier`` code 1. `unset NAME`. Both only act when `alone`.
  - `find [PATH…] [-maxdepth N] [-name GLOB] [-iname GLOB] [-type f|d] [-perm MODE|-MODE|/MODE] [-user U] [-group G]` — tests ANDed, default path `.`, prints matches in pre-order with children sorted by name; `-perm` takes octal or symbolic (`-u=s`, `/u=s,g=s`). Unreadable dir → `find: '/root': Permission denied` on stderr, exit 1, search continues. Unknown primary → `find: unknown predicate '-exec'` code 1 (the lab supports only the tests above).
  - `tr SET1 SET2`, `tr -d SET1`; escapes `\n \t \0 \\`; ranges `a-z`.
  - `uname` → `Linux`; `-a` → `Linux <hostname> 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux`; `-r`, `-s`, `-n`, `-m`.

- [ ] **Step 1: Failing tests.** Parser: each redirect form and order rule. Shell: `cat nofile 2> err.txt` writes the message to err.txt and nothing to the screen; `cat nofile 2>/dev/null` → empty, code 1; `ls /root nofile 2>&1 | wc -l` counts both errors. `find` (Review Focus #2): as learner, `find / -name passwd` prints `/etc/passwd` on stdout and `find: '/root': Permission denied` on stderr, code 1; with `2>/dev/null` stderr is empty; `-perm -4000` / `-perm /6000` / `-perm -u=s`; `-type d -maxdepth 1`; `-user root -group shadow`; `-exec` error. env/export/unset incl. Review Focus #5 (`export X=1 | cat` then `echo $X` → empty). `tr '\0' ' '`, `tr -d '\n'`, `tr a-z A-Z`. `uname -a` exact.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS (`help` test updated with the new commands).
- [ ] **Step 3:** Commit `feat(terminal): stderr redirects, /dev/null, env/export/unset, find, tr, uname`.

---

### Task 4: Processes, signals and /proc

**Files:**
- Create: `lib/lab-engine/terminal/processes.ts`, `lib/lab-engine/terminal/procfs.ts`, `commands/ps.ts`, `commands/pgrep.ts`, `commands/kill.ts`
- Modify: `types.ts` (`World.processes?: Proc[]`, `World.shellPid?: number`), `vfs.ts` (`mount(path, provider: () => DirNode)`: lookups at or below a mount point use the provider's tree; mounted trees are read-only), `shell.ts`, `commands/types.ts` (`CmdContext.procs: ProcessTable`), `commands/index.ts`
- Test: `tests/unit/lib/lab-engine/terminal/processes.test.ts`, `procfs.test.ts`, `commands/ps.test.ts`, `commands/pgrep.test.ts`, `commands/kill.test.ts`, `fixture-processes.ts`

**Interfaces:**
- Produces (`processes.ts`):
  - `type Proc = { pid: number; ppid: number; user: string; argv: string[]; state: "R" | "S" | "D" | "Z" | "I"; stat?: string /* full STAT column, e.g. "Ss", "Sl" */; tty: string /* "?" or "pts/0" */; start: string /* "08:55" */; cpuTime: string /* "0:02" */; cpu: number; mem: number; vsz: number; rss: number; env?: Record<string, string>; cwd?: string }`
  - `class ProcessTable { list(): Proc[]; get(pid): Proc | undefined; kill(pid, signal, asUser): "ok" | "ESRCH" | "EPERM" | "IGNORED"; spawnCommand(argv, user): Proc /* the running command itself, next PID */ }` — killing reparents children to PID 1; the learner's shell (`shellPid`, default 2201, parent sshd session) ignores TERM (`"IGNORED"`); PID 1 refuses (`"EPERM"` for non-root, `"IGNORED"` for root).
- `procfs.ts`: `procTree(table, sysinfo): DirNode` with `version`, `cpuinfo`, `meminfo`, `uptime` (`3600.12 7012.40`), and per PID `cmdline` (argv joined by `\0`, mode 0444), `comm` (basename of argv[0], max 15 chars), `status` (`Name`, `State` e.g. `S (sleeping)`, `Pid`, `PPid`, `Uid` (4 columns), `Gid`), `environ` (mode 0400, owner = process user; `\0`-separated). Mounted at `/proc`, rebuilt from the table on each lookup.
- Pinned formats (procps-ng 4.0.4):
  - `ps aux` header `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND`; rows: USER left width 8 (longer names → first 7 chars + `+`, e.g. `systemd+`), PID right 7, %CPU right 4 (1 decimal), %MEM right 4, VSZ right 6, RSS right 5, TTY left 8, STAT left 4, START 5, TIME right 6, COMMAND = argv joined by spaces. Kernel threads (`argv[0]` in `[...]`) shown as-is. Includes the `ps aux` process itself (from `spawnCommand`).
  - `ps -ef` header `UID          PID    PPID  C STIME TTY          TIME CMD`; UID left 8, PID right 7, PPID right 7, C right 2, STIME 5, TTY left 8, TIME right 8 (`00:00:02`), CMD.
  - `ps` → `    PID TTY          TIME CMD` and only `pts/0` processes of the user (bash + ps).
  - `pgrep PATTERN` (regex on comm) prints PIDs; `-l` → `PID comm`; `-a` → `PID full command`; `-f` match full command line; `-u USER`; no match → no output, code 1.
  - `kill [-SIGNAL] PID…` with `-9`, `-KILL`, `-SIGKILL`, `-15`, `-TERM`, default TERM; `kill -l` → `1) SIGHUP 2) SIGINT …` first 15 signals in bash layout. Errors (bash builtin wording): `bash: kill: (99999) - No such process`, `bash: kill: (1) - Operation not permitted`, `bash: kill: abc: arguments must be process or job IDs`, `kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]`. Killing your own shell → no output, nothing happens (TERM ignored); `kill -9 <own shell>` → `kill: this lab keeps your shell running` code 1.

- [ ] **Step 1: Failing tests** on `fixture-processes.ts` (init, kthreadd + one `[kworker/0:1]`, systemd-journald, systemd-resolved as `systemd-resolve`, cron, sshd listener + session, the learner's bash, a root `python3 -m http.server` and a learner `sleep 600`): exact `ps aux`, `ps -ef`, `ps` text; `pgrep -l cron`, `pgrep -u root -a python`, `pgrep nosuch` code 1; `cat /proc/<pid>/cmdline | tr '\0' ' '`; `cat /proc/<pid>/status` lines; learner reads own `environ` but gets `Permission denied` on root's; `ls /proc` lists PIDs numerically then the info files; Review Focus #4 (kill own shell, `kill 1`, `kill 99999`, `kill abc`; `kill <sleep pid>` then `ps aux` and `ls /proc/<pid>` both show it gone; killing a parent reparents its child to 1).
- [ ] **Step 2:** Run → FAIL. Implement (table, then procfs + mount, then each command). Run → PASS.
- [ ] **Step 3:** Commit `feat(terminal): processes, ps, pgrep, kill and /proc`.

---

### Task 5: Services and privilege — systemctl, sudo, su

**Files:**
- Create: `lib/lab-engine/terminal/services.ts`, `lib/lab-engine/terminal/sudoers.ts`, `commands/systemctl.ts`, `commands/sudo.ts`, `commands/su.ts`
- Modify: `types.ts` (`World.services?: Service[]`), `shell.ts` (run one command as another user: `runAs(user, argv)` re-enters dispatch with `ctx.user` = target), `commands/index.ts`
- Test: `tests/unit/lib/lab-engine/terminal/sudoers.test.ts`, `commands/systemctl.test.ts`, `commands/sudo.test.ts`, `commands/su.test.ts`

**Interfaces:**
- `type Service = { name: string /* "ssh" */; description: string; unitPath: string; enabled: "enabled" | "disabled" | "static"; active: "active" | "inactive" | "failed"; sub: "running" | "exited" | "dead" | "failed"; since?: string /* "Wed 2026-10-07 08:55:04 IST" */; mainPid?: number; result?: string /* "exit-code" */ }`
- `sudoers.ts`: `parseSudoers(text): Rule[]`, `type Rule = { who: string /* user or %group */; runAs: string; nopasswd: boolean; commands: string[] /* full paths or "ALL" */ }`; supports `Defaults` lines (kept for display), `user ALL=(root) NOPASSWD: /usr/bin/find, /usr/bin/systemctl status *`, `%sudo ALL=(ALL:ALL) ALL`, comments, `#includedir` ignored. `rulesFor(rules, user, groups)`.
- Pinned behaviour:
  - `systemctl status NAME[.service]` (systemd 255 layout, no journal lines): `● ssh.service - OpenBSD Secure Shell server` (`○` inactive, `×` failed), `     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)`, `     Active: active (running) since Wed 2026-10-07 08:55:04 IST; 1h 4min ago` (elapsed against the fixed now), `   Main PID: 812 (sshd)`, `     CGroup: /system.slice/ssh.service`, `             └─812 "<argv joined>"`. Exit code 0 active, 3 inactive/failed, 4 unknown (`Unit nosuch.service could not be found.`).
  - `systemctl list-units --type=service [--state=running|failed|active]`: header `  UNIT  LOAD   ACTIVE SUB     DESCRIPTION` padded to widest, failed rows start `● `, then blank line, the three `Legend:` lines, blank, `N loaded units listed. Pass --all to see loaded but inactive units, too.`, `To show all installed unit files use 'systemctl list-unit-files'.`
  - `systemctl is-active NAME` / `is-enabled NAME` → one word, exit 0/3. Any other verb → `systemctl: this lab can only inspect services (status, list-units, is-active, is-enabled)` code 1.
  - `sudo -l`: `Matching Defaults entries for <user> on <host>:`, the Defaults (comma-joined, 4-space indent), blank, `User <user> may run the following commands on <host>:`, one line per rule `    (root) NOPASSWD: /usr/bin/find`. No rules → `Sorry, user <user> may not run sudo on <host>.` code 1.
  - `sudo CMD ARGS…`: allowed only when a NOPASSWD rule matches (`ALL`, or the command's path `/usr/bin/<name>`, with optional trailing `*` argument wildcard); runs CMD as root. A rule that needs a password → `sudo: this lab can't ask for a password — only NOPASSWD commands from 'sudo -l' can run` code 1. No matching rule → `Sorry, user <user> is not allowed to execute '/usr/bin/<cmd> <args>' as root on <host>.` code 1. Every attempt appends to `/var/log/auth.log`: `Oct  7 10:00:00 <host> sudo: <user> : TTY=pts/0 ; PWD=<cwd> ; USER=root ; COMMAND=/usr/bin/<cmd> <args>` (refusals add `command not allowed ; ` after the user like real sudo). `sudo` inside a pipeline or with a redirect still runs and logs (Review Focus #5).
  - `su [USER]` / `su -` → `su: this lab can't ask for a password — use sudo for allowed commands` code 1.

- [ ] **Step 1: Failing tests.** `sudoers.test.ts`: each rule form; group rule via `%sudo`. systemctl: status for running, inactive, failed and unknown units (exact text + exit codes); list-units with a failed unit; `--state=failed`; refused verb. sudo: `sudo -l` exact; allowed `sudo cat /etc/shadow` with a `/usr/bin/cat` NOPASSWD rule prints the file; a password rule → lab message; not allowed → exact Sorry line; `whoami` under sudo → `root`; each case appends the exact auth.log line; `sudo -l > out.txt` writes the listing and still logs. su message.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(terminal): systemctl inspection, sudo rules and su`.

---

### Task 6: A Linux-shaped demo machine

**Files:**
- Modify: `lib/lab-engine/terminal/demo-world.ts`, `lib/generators/terminal/base-world.ts`
- Test: `tests/unit/lib/lab-engine/terminal/demo-world.test.ts`

**Interfaces:**
- Produces: `demoWorld()` gains `processes` (init, kthreadd, `[kworker/0:1-events]`, systemd-journald, `systemd-resolve` (pid 455), cron, sshd 812 + session, rsyslogd, nginx master+worker as `www-data` worker, the learner's bash 2201), `services` (ssh, cron, nginx, systemd-resolved active; `backup.service` failed; `apache2` inactive), `/etc/sudoers` (`Defaults env_reset`, `Defaults mail_badpass`, `Defaults secure_path=…`, `Defaults use_pty`, `root ALL=(ALL:ALL) ALL`, `%sudo ALL=(ALL:ALL) ALL`, `learner ALL=(root) NOPASSWD: /usr/bin/systemctl status *`) mode 0440, `/etc/crontab` (standard Ubuntu header + run-parts lines), `/usr/bin` with stub binaries (`ls`, `cat`, `find`, `systemctl`, …) and the standard Ubuntu SUID/SGID set (`passwd`, `sudo`, `su`, `mount`, `umount`, `chsh`, `chfn`, `gpasswd`, `newgrp` 4755 root; `chage`, `expiry` 2755 root:shadow; `crontab` 2755 root:crontab), unit files under `/usr/lib/systemd/system/`, `/dev/null`, `/etc/ssh/sshd_config` (Ubuntu defaults with `PermitRootLogin prohibit-password`, `PasswordAuthentication yes`), `~/.ssh/authorized_keys` (one `ssh-ed25519 … learner@laptop` key, mode 0600) and `~/.ssh/` mode 0700. Stub binary content: `\x7fELF (simulated binary — not runnable in this lab)\n`.
- `baseWorld()` accepts `processes`, `services`, `sudoers` options with the same defaults minus the demo-only items.

- [ ] **Step 1: Failing test** `demo-world.test.ts`: `find / -perm -4000 2>/dev/null` lists exactly the 9 SUID paths sorted; `ps aux | grep -c sshd`; `systemctl list-units --type=service --state=failed` shows only `backup.service`; `sudo -l` shows the learner's rule; all Rank 0 and 2A content still passes `npm run check:content` (regenerate any shown output the gate flags).
- [ ] **Step 2:** Run → FAIL. Implement. Run `npm test && npm run check:content` → PASS.
- [ ] **Step 3:** Commit `feat(terminal): Linux demo machine — processes, services, sudoers, SUID set`.

---

### Task 7: Rank 1 Linux labs (permissions puzzle, process hunt, SUID/sudo audit)

**Files:**
- Create: `lib/generators/linux/perms-lab.ts`, `proc-lab.ts`, `suid-lab.ts`; `labs/core-r1-linux-perms-lab-01/{lab.yaml,briefing.md}`, `labs/core-r1-linux-proc-lab-01/…`, `labs/core-r1-linux-suid-lab-01/…`
- Modify: `lib/generators/index.ts` (`perms_lab`, `proc_lab`, `suid_lab`)
- Test: `tests/labs/core-r1-linux-perms-lab-01.test.ts`, `core-r1-linux-proc-lab-01.test.ts`, `core-r1-linux-suid-lab-01.test.ts`

**Interfaces:** each generator returns `{ env: { kind: "terminal", world }, answers }` built on `baseWorld`; `rank: 1`, `xp: 100`, 4 objectives, 3 hints each (last hint names the command, never the answer).

| Lab | Objectives (answer key) | case_sensitive | MITRE |
|---|---|---|---|
| perms | o1 octal mode of `/srv/app/config.ini` (`mode`, e.g. "640", seeded from a set of 6) · o2 flag in `~/vault/note.txt`, a file the learner owns with mode 000 — readable only after `chmod u+r` (`flag`) · o3 the group that may read `/srv/payroll/salaries.csv` (`group`) · o4 the one world-writable file in `/srv/shared/` among 5–8 (`writable`) | o3 false, others true | T1222.002 |
| proc | o1 PID of the process whose executable lives under `/tmp` or `/dev/shm` and is named like a kernel or system process (`pid`) · o2 the user it runs as (`user`) · o3 the name of its parent process (`parent`) · o4 the `host:port` in its command line, read via `ps -ef` or `/proc/<pid>/cmdline` (`remote`) — among 25–35 normal processes, 2 decoy `/tmp` scripts owned by the learner that are clearly benign (`/tmp/build.sh`) | o2/o3 false | T1057, T1036.005 |
| suid | o1 the one non-standard SUID path (under `/usr/local/bin` or `/opt/<tool>/bin`, name seeded) (`suid`) · o2 how many SUID files exist (`count`, standard set 9 ± a seeded subset of optional ones) · o3 its owner (`owner`) · o4 the program the learner may run as root without a password, per `sudo -l` (`sudoCmd`, full path) | o1/o4 true | T1548.001, T1548.003 |

- [ ] **Step 1: Failing tests.** Solve like a learner over `SEEDS`: perms — `ls -l` + mode arithmetic, `chmod u+r ~/vault/note.txt && cat …`, `ls -l /srv/payroll`, `find /srv/shared -perm -o+w`; proc — `ps -ef`, pick the command running from `/tmp` or `/dev/shm`, read `PPid` from `cat /proc/<pid>/status` and find that PID's name in `ps -ef`, then `cat /proc/<pid>/cmdline | tr '\0' ' '`; suid — `find / -perm -4000 2>/dev/null`, `wc -l`, `ls -l <path>`, `sudo -l`. Property tests over `MANY_SEEDS`: exactly one world-writable file and the vault note is unreadable before chmod; exactly one suspicious process and no decoy matches it; exactly one non-standard SUID path and the count equals `find` output lines; every answer is checked by `check()` and a wrong-but-plausible one (e.g. a decoy PID, a standard SUID path) is rejected.
- [ ] **Step 2:** Run → FAIL. Implement generators + lab.yaml + briefings. Run `npm test && npm run check:content` → PASS.
- [ ] **Step 3:** Commit `feat(labs): rank 1 Linux labs — permissions, process hunt, SUID/sudo audit`.

---

### Task 8: Linux lessons (draft content) + coverage

**Files:** `content/core/rank-1/NN-<slug>.mdx` + `.checks.yaml` ×7 (orders 10–16, `module: linux`); modify `content/coverage/core.yaml`, `docs/curriculum/cert-targets.md` (Linux+ row in "Shared core")

| # | id | title | lab | Debrief incident (verify against primary sources while writing) | ATT&CK |
|---|---|---|---|---|---|
| 10 | `core-r1-linux-fs-01` | The Linux Filesystem and the Shell | — (field exercise) | Cryptomining campaigns (e.g. Kinsing, 2020–23 public reports) hiding binaries in `/tmp` and `/dev/shm` | T1083 |
| 11 | `core-r1-linux-users-01` | Users, Groups and sudo | — (field exercise) | Baron Samedit, sudo heap overflow (CVE-2021-3156, Jan 2021) | T1087.001, T1078.003 |
| 12 | `core-r1-linux-perms-01` | Permissions: Read, Write, Execute | `core-r1-linux-perms-lab-01` | Dirty COW (CVE-2016-5195, Oct 2016): writing to read-only files | T1222.002 |
| 13 | `core-r1-linux-special-01` | SUID, SGID, the Sticky Bit and sudo Rules | `core-r1-linux-suid-lab-01` | PwnKit, pkexec (CVE-2021-4034, Jan 2022) | T1548.001, T1548.003 |
| 14 | `core-r1-linux-proc-01` | Processes, Signals and /proc | `core-r1-linux-proc-lab-01` | XZ Utils backdoor (CVE-2024-3094, Mar 2024), noticed through slow, CPU-hungry sshd logins | T1057, T1036.005 |
| 15 | `core-r1-linux-services-01` | Services, Cron and the Environment | — (field exercise) | Shellshock (CVE-2014-6271, Sep 2014): code in environment variables | T1543.002, T1053.003, T1574.007 |
| 16 | `core-r1-linux-investigate-01` | Logs, SSH and Investigating a Linux Host | — (field exercise) | Ebury SSH backdoor (ESET: Windigo 2014, 400,000 servers by 2024) | T1021.004, T1098.004, T1070.002 |

Rules: `track: core`, `rank: 1`, `order` as above, `estimated_minutes` 25–40, `xp: 100`, ~1,500–1,800 words like Rank 1 networking, every command in the Command / In simple English / Why do I care? / Important part / What should I look for? format with output captured from `demoWorld()`. Lessons 13, 14 and 16 carry the authorization note. Lesson 13 teaches *finding and fixing* SUID and sudo misconfigurations (inventory, baseline comparison, removing the bit, tightening rules); exploitation steps are out of scope for Rank 1. Real-machine-only commands (`journalctl`, `crontab -e`, `sudo systemctl restart`, `ssh-keygen`) only in `text` blocks marked "on a real Linux machine". Checks: 4 each.

Coverage additions (mark "VERIFY" in the file header, as in 2A): cert `linuxplus: { name: "CompTIA Linux+", exam: "XK0-006" }` with domain-level ids (like A+): `linuxplus:1` System management, `linuxplus:2` Services and user management, `linuxplus:3` Security, `linuxplus:5` Troubleshooting — `target_rank: 1`; `secplus:2.4` indicators of malicious activity, `secplus:2.5` mitigation techniques (least privilege, hardening), `secplus:4.1` security techniques for computing resources (hardening), `secplus:4.6` identity and access management — `target_rank: 2`. `aplus1202:1` (already rank 1) is also covered by lessons 10–12. Keep `built_ranks: [0]` until Rank 1 completes in 2C.

- [ ] **Step 1:** Lessons 10–12 + checks; capture every console output from `demoWorld()` with a scratch script (not committed); `npm run check:content` → PASS.
- [ ] **Step 2:** Lessons 13–14 + checks → PASS.
- [ ] **Step 3:** Lessons 15–16 + checks + coverage + cert-targets row → PASS.
- [ ] **Step 4:** Commit `content(core): rank 1 Linux lessons (draft, pending expert review)`.

---

### Task 9: End-to-end — the Rank 1 map and a Linux lab journey

**Files:**
- Modify: `tests/e2e/rank-1-networking.spec.ts` (rank 1 now lists 16 lessons: 9 networking + 7 Linux)
- Create: `tests/e2e/rank-1-linux.spec.ts`

- [ ] **Step 1: Write the tests** (desktop): a promoted operator opens lesson 13, answers its checks (`answerAllChecks`), opens the SUID lab, runs `find / -perm -4000 2>/dev/null`, `sudo -l` and `ls -l <path>` in the terminal, submits all four objectives with `submit <n> <answer>`, sees "Lab complete" and "Continue to next lesson: Processes, Signals and /proc →". Mobile: lesson 12 has no horizontal page scroll (wide `ls -l` blocks scroll inside their own box).
- [ ] **Step 2:** `npm run test:e2e` → PASS. Full gate: `npm run lint && npm run typecheck && npm test && npm run check:content && npm run build` → all exit 0.
- [ ] **Step 3:** Commit `test(e2e): rank 1 Linux journey`.
- [ ] **Step 4:** Owner gate: the 7 Linux lessons stay `draft` pending human expert review; list them, the coverage ids to verify, and the deferred items in the final message. Merge into local `main` (no push).

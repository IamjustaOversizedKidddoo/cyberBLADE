# Phase 1 — Learning Engine + Rank 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new user completes Rank 0 fully in the browser: reads 6 lessons, passes their Terminal Checks, solves the terminal labs, passes the timed Rank 0 challenge and is promoted to Rank 1 · Operator.

**Architecture:** Content (MDX lessons, `*.checks.yaml`, `labs/<id>/lab.yaml`) is read from the repo on the server and validated with zod. The `terminal` lab engine is pure TypeScript (virtual FS + parser + one file per command) driven by an xterm.js view. Lab worlds come from seeded generators; the server picks the seed, sends the client only the generated world, and re-generates on submit to check answers — answer keys never leave the server. All progress writes (checks, objectives, XP, rank) go through `lib/progress/service.ts` against a `ProgressRepo` interface (in-memory in tests, a local JSON file under `.data/` for now — local-first, owner decision 2026-10-06; Supabase replaces it in the hosted phase). The browser never writes progress directly.

**Tech Stack:** Phase 0 stack + `@mdx-js/mdx` (server `evaluate`) + `remark-gfm` · `gray-matter` · `yaml` · `@xterm/xterm` + `@xterm/addon-fit` · `tsx` (for scripts).

**Spec:** `docs/specs/2026-10-06-platform-design.md` (§3.2 lesson loop, §3.3 rank gates, §4 content standard, §6 Rank 0 outline, §7 lab engine, §11.2 data model, §14 Phase 1). Also `CLAUDE.md` (lesson template, lab rules). Builds on `docs/plans/2026-10-06-phase-0-foundation.md`.

## Global Constraints

- Done when: "A new user completes Rank 0 fully in the browser" (spec §14).
- Every lesson follows the CLAUDE.md template exactly: frontmatter keys `id title track rank module order estimated_minutes objectives_covered mitre lab xp status last_reviewed`; body sections `## Briefing` (with `### 1.`…`### 6.` subsections in template order), `## Terminal Check`, `## Lab`, `## Debrief`.
- All lessons ship `status: draft`, `last_reviewed: null`. Production shows only `published`; `NEON_SHOW_DRAFTS=true` (dev, preview, e2e) shows drafts with a visible "DRAFT — not yet expert-reviewed" banner. Never flip status in code.
- Original content only; objectives mapped by ID, never vendor text. Every command shown in a lesson must run in the lab engine (enforced by Task 9's check).
- Terminal Checks: 3–5 questions (basic, conceptual, practical, security, scenario), every option has an explanation (CLAUDE.md).
- Lesson prose follows `docs/curriculum/teaching-style.md` (binding).
- Lab definition per spec §7.2; datasets from seeded generators; answer keys never sent to the client; every lab has a test that solves it.
- Rank advance requires passing a practical, timed, per-learner-randomized challenge; retry after cooldown with a new seed (spec §3.3).
- One lab type per folder in `lib/lab-engine/`; small focused files; TDD for all of `lib/`.
- Flag format: `NEON{` + 12 lowercase hex + `}`, built by `formatFlag(hex)` in `lib/generators/flag.ts` (brand is a placeholder; one place to change).
- Handler (AI tutor) is Phase 2 — no chat UI in this phase.

## Review Focus

1. Learner refreshes the lab page mid-lab → same world, solved objectives kept (open attempt reused, not re-seeded). Test in Task 6.
2. Learner pastes a flag with surrounding spaces/newline → accepted; different case or one wrong char → rejected. Test in Task 5.
3. Double-click / two tabs completing the same lesson or lab → XP awarded once. Test in Task 6 (service + file repo concurrency).
4. Challenge answers submitted after the time limit (e.g. tab left open, clock tampered client-side) → rejected server-side and attempt marked failed; cooldown starts. Test in Task 8.
5. Beginner typos in the terminal: `ls -z`, `cd ../../../../..`, `cat` on a directory, unknown command, unmatched quote → realistic error line, shell keeps working. Tests in Tasks 3–4.

---

### Task 1: Content schema and loader

**Files:**
- Create: `lib/content/schema.ts`, `lib/content/lessons.ts`, `lib/content/visibility.ts`
- Test: `tests/unit/lib/content/schema.test.ts`, `tests/unit/lib/content/lessons.test.ts`, fixtures `tests/fixtures/content/core/rank-0/*.mdx`

**Interfaces:**
- Produces:
  - `lessonFrontmatterSchema` (zod) — `id` matches `/^(core|soc|pentest|cloud)-r\d-[a-z0-9-]+-\d{2}$/`; `track` enum `core|soc|pentest|cloud`; `rank` int 0–5; `order` int ≥1; `estimated_minutes` int 5–120; `objectives_covered: string[]`; `mitre: string[]` each `/^T\d{4}(\.\d{3})?$/`; `lab?: string`; `xp` int >0; `status` enum `draft|reviewed|published`; `last_reviewed: string (ISO date) | null`.
  - `type Lesson = LessonFrontmatter & { slug: string; filePath: string; body: string }`
  - `loadLessons(root = "content"): Promise<Lesson[]>` — globs `content/core/rank-*/**/*.mdx` and `content/tracks/**/*.mdx`, parses with gray-matter, throws `Error("<filePath>: <zod issue>")` on invalid frontmatter or duplicate `id`; sorted by `track, rank, order`.
  - `isVisible(l: Lesson, showDrafts: boolean): boolean` — `published` always; others only if `showDrafts`.
  - `getLessons({ rank?, track? })` / `getLesson(id)` — cached wrappers applying `isVisible(…, process.env.NEON_SHOW_DRAFTS === "true")`.

- [ ] **Step 1: Failing tests:** valid fixture parses; missing `xp` → throws message containing the file path and `xp`; two fixtures with same `id` → throws "duplicate id"; `isVisible({status:"draft"}, false) === false`, `isVisible({status:"published"}, false) === true`; ordering by `order`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(content): lesson frontmatter schema and loader`.

---

### Task 2: Terminal Check data and grading

**Files:**
- Create: `lib/content/checks.ts`
- Test: `tests/unit/lib/content/checks.test.ts`

**Format** (`<lesson-file>.checks.yaml`, next to the `.mdx`):
```yaml
lesson: core-r0-comp-hardware-01
questions:
  - id: q1
    prompt: "…"
    options:
      - { text: "…", correct: true,  explanation: "…" }
      - { text: "…", correct: false, explanation: "…" }
```

**Interfaces:**
- Produces:
  - `checksSchema` — 3–5 questions; each 2–5 options; exactly one `correct: true`; every option has non-empty `explanation`; question ids unique.
  - `loadChecks(lessonId: string): Promise<CheckSet>` (server-only).
  - `toPublicChecks(set: CheckSet): { id: string; prompt: string; options: string[] }[]` — strips `correct` and `explanation`.
  - `gradeCheck(set: CheckSet, questionId: string, optionIndex: number): { correct: boolean; explanations: string[] }` — throws on unknown question/out-of-range index.

- [ ] **Step 1: Failing tests:** schema rejects 2 questions, 6 questions, two correct options, empty explanation; `JSON.stringify(toPublicChecks(set))` contains neither `"correct"` nor any explanation text; `gradeCheck` right/wrong cases return all explanations; out-of-range index throws.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(content): terminal check schema, public view, grading`.

---

### Task 3: Terminal engine — virtual filesystem and parser

**Files:**
- Create: `lib/lab-engine/terminal/vfs.ts`, `lib/lab-engine/terminal/parser.ts`, `lib/lab-engine/terminal/types.ts`
- Test: `tests/unit/lib/lab-engine/terminal/vfs.test.ts`, `tests/unit/lib/lab-engine/terminal/parser.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type Node = { kind: "file"; content: string; owner: string; group: string; mode: number; mtime: string } | { kind: "dir"; children: Record<string, Node>; owner: string; group: string; mode: number; mtime: string }` — `mode` is octal permission bits (e.g. `0o644`); `mtime` ISO.
  - `type World = { hostname: string; user: string; home: string; root: Node /* dir */; env?: Record<string,string> }` — the JSON a generator returns and the client receives.
- `vfs.ts`:
  - `resolvePath(cwd: string, p: string, home: string): string` — handles absolute, relative, `.`, `..`, `~`, `~/x`, repeated `/`; `..` at `/` stays `/`.
  - `class Vfs { constructor(root: Node); stat(path): Node | null; readFile(path, user): string /* throws VfsError */; list(path, user): [name, Node][]; write(path, content, user, append: boolean); mkdir(path, user, parents: boolean); touch(path, user) }`
  - `class VfsError extends Error { code: "ENOENT" | "ENOTDIR" | "EISDIR" | "EACCES" | "EEXIST" }`
  - Permission rule: user `root` bypasses; owner uses bits `0o700`, else "other" bits `0o007` (groups = owner-match only in v1). Read file needs r; list dir needs r; enter/traverse dir needs x; write needs w on file (or on parent dir to create).
  - `formatMode(node): string` → e.g. `drwxr-x---`, `-rw-r--r--`.
- `parser.ts`:
  - `parseLine(line: string, env: Record<string,string>): Pipeline | ParseError` where `Pipeline = { commands: { argv: string[]; redirect?: { op: ">" | ">>"; path: string } }[] }`; supports single/double quotes, backslash escape, `$VAR`/`${VAR}` (not in single quotes), `|`, `>`, `>>`. `ParseError = { error: string }` — unmatched quote → `"syntax error: unexpected end of file"`.
  - `expandGlobs(argv: string[], cwd, vfs, home): string[]` — `*` and `?` in the final path segment; no match → literal kept (bash default); results sorted.

- [ ] **Step 1: Failing tests** (key assertions):
```ts
expect(resolvePath("/home/op", "../../../..", "/home/op")).toBe("/");
expect(resolvePath("/tmp", "~/notes", "/home/op")).toBe("/home/op/notes");
expect(formatMode({ kind: "dir", mode: 0o750 } as Node)).toBe("drwxr-x---");
expect(() => vfs.readFile("/root/secret", "op")).toThrow(expect.objectContaining({ code: "EACCES" }));
expect(parseLine(`echo "a b" 'c $HOME' $HOME | grep a > out.txt`, { HOME: "/h" })).toEqual({ commands: [
  { argv: ["echo", "a b", "c $HOME", "/h"] },
  { argv: ["grep", "a"], redirect: { op: ">", path: "out.txt" } } ] });
expect(parseLine(`echo "oops`, {})).toEqual({ error: "syntax error: unexpected end of file" });
expect(expandGlobs(["cat", "*.log"], "/var/log", vfs, "/h")).toEqual(["cat", "auth.log", "sys.log"]);
expect(expandGlobs(["cat", "*.zip"], "/var/log", vfs, "/h")).toEqual(["cat", "*.zip"]);
```
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(terminal): virtual filesystem, permissions, parser, globbing`.

---

### Task 4: Terminal engine — shell and Rank 0 command set

**Files:**
- Create: `lib/lab-engine/terminal/shell.ts`, `lib/lab-engine/terminal/commands/index.ts`, and one file per command in `lib/lab-engine/terminal/commands/`: `help pwd cd ls cat echo whoami hostname clear history mkdir touch head tail grep wc`
- Test: `tests/unit/lib/lab-engine/terminal/shell.test.ts`, `tests/unit/lib/lab-engine/terminal/commands/<cmd>.test.ts` (one per command)

**Interfaces:**
- Consumes: `Vfs`, `resolvePath`, `parseLine`, `expandGlobs`, `World` (Task 3).
- Produces:
  - `type CmdResult = { stdout: string; stderr: string; code: number; clear?: boolean }`
  - `type CmdContext = { argv: string[]; stdin: string; vfs: Vfs; cwd: string; user: string; home: string; hostname: string; env: Record<string,string>; history: string[]; setCwd(p: string): void }`
  - `type Command = { name: string; summary: string; run(ctx: CmdContext): CmdResult }` — `COMMANDS: Record<string, Command>` in `commands/index.ts`.
  - `createShell(world: World): { exec(line: string): CmdResult; cwd(): string; prompt(): string }` — prompt `${user}@${hostname}:${cwd with home→~}$ `; starts in `home`; runs a pipeline left→right feeding stdout to next stdin; applies redirect at the end (stdout written to file, not returned); stderr of all stages concatenated; `code` of last stage; records non-empty lines in history.
- Pinned behaviour (match GNU/bash wording):
  - unknown: `<cmd>: command not found`, code 127.
  - `cd` no arg → home; `cd -` → previous dir; errors `bash: cd: <arg>: No such file or directory` / `Not a directory` / `Permission denied`, code 1.
  - `ls` flags `-l -a` (combinable `-la`/`-al`), multiple paths; sort by name ignoring a leading `.` and case; hidden only with `-a` (which also shows `.` and `..`); plain output = names joined by two spaces; `-l` lines `<mode> 1 <owner> <group> <size right-aligned to widest> <Mon dd HH:MM> <name>` with `total <n>` header (n = number of entries, documented simplification); invalid flag → `ls: invalid option -- 'z'` + `Try 'ls --help' for more information.`, code 2; missing → `ls: cannot access '<p>': No such file or directory`; no permission → `ls: cannot open directory '<p>': Permission denied`.
  - `cat` files or stdin: `cat: <p>: No such file or directory` / `Is a directory` / `Permission denied`.
  - `head`/`tail` `-n N` (and `-N`), default 10. `grep [-i] [-n] [-v] [-c] PATTERN [FILE...]` — PATTERN compiled as a JS `RegExp` (covers the basic-regex subset lessons use); invalid pattern → `grep: Invalid regular expression`, code 2; `file:` prefix when >1 file; code 1 when no match. `wc [-l] [-w] [-c]`. `mkdir [-p]` (`mkdir: cannot create directory '<p>': File exists`). `echo` joins args with spaces. `history` numbered `  1  ls`. `clear` returns `clear: true`. `help` lists every `COMMANDS` entry with its `summary`.

- [ ] **Step 1: Failing tests** — per command file, the pinned strings above plus success paths; `shell.test.ts`:
```ts
const sh = createShell(fixtureWorld); // user "op", home /home/op, host "neon-lab"
expect(sh.prompt()).toBe("op@neon-lab:~$ ");
expect(sh.exec("frobnicate")).toMatchObject({ stderr: "frobnicate: command not found\n", code: 127 });
expect(sh.exec("cat /var/log/auth.log | grep -c Failed").stdout).toBe("3\n");
sh.exec("echo hi > note.txt"); expect(sh.exec("cat note.txt").stdout).toBe("hi\n");
expect(sh.exec(`echo "oops`).stderr).toMatch(/unexpected end of file/);
expect(sh.exec("pwd").stdout).toBe("/home/op\n"); // still alive after errors
```
- [ ] **Step 2:** Run → FAIL. Implement shell then commands one at a time until each command test passes.
- [ ] **Step 3:** Run `npm test` → PASS.
- [ ] **Step 4:** Commit `feat(terminal): shell with pipes/redirects and Rank 0 command set`.

---

### Task 5: Lab definitions, seeded generators, answer checks

**Files:**
- Create: `lib/lab-engine/lab-schema.ts`, `lib/lab-engine/labs.ts`, `lib/lab-engine/checks.ts`, `lib/generators/rng.ts`, `lib/generators/flag.ts`, `lib/generators/index.ts`
- Test: `tests/unit/lib/lab-engine/lab-schema.test.ts`, `tests/unit/lib/lab-engine/checks.test.ts`, `tests/unit/lib/generators/rng.test.ts`

**Interfaces:**
- Produces:
  - `labSchema` (zod) — spec §7.2 fields: `id title type track rank estimated_minutes briefing dataset{generator, params} objectives[{id, prompt, check{kind:"flag", answer_from:"generator.<key>", case_sensitive?: boolean = true}}] hints{<objId>: string[]} xp mitre`; `type` enum currently only `"terminal"` accepted (others rejected until built); optional `challenge: { rank: number; time_limit_minutes: number; cooldown_minutes: number }`. Every `hints` key must be an objective id.
  - `loadLab(id): Promise<Lab>` / `listLabs(): Promise<Lab[]>` — reads `labs/<id>/lab.yaml` + `briefing.md`; folder name must equal `id`.
  - `type Rng = { next(): number /* [0,1) */; int(min, max): number; pick<T>(xs: readonly T[]): T; hex(n: number): string; shuffle<T>(xs: T[]): T[] }`; `createRng(seed: string): Rng` — xmur3 string hash → mulberry32.
  - `newSeed(): string` — 16 hex chars from `crypto.randomUUID`/`getRandomValues` (server).
  - `formatFlag(hex: string): string` → `NEON{<hex>}`.
  - `type Generator<P = Record<string, unknown>> = (rng: Rng, params: P) => { world: World; answers: Record<string, string> }`; `GENERATORS: Record<string, Generator>` in `lib/generators/index.ts`.
  - `generateLab(lab: Lab, seed: string): { world: World; answers: Record<string,string> }`
  - `normalizeAnswer(s: string): string` — trims whitespace incl. newlines, collapses inner runs of spaces.
  - `checkObjective(lab: Lab, answers: Record<string,string>, objectiveId: string, submitted: string): boolean`

- [ ] **Step 1: Failing tests:** `createRng("abc").hex(12)` is deterministic across calls and differs from `createRng("abd")`; `int(1,6)` over 10k draws stays in range and hits both ends; `formatFlag("0123456789ab") === "NEON{0123456789ab}"`; schema rejects `type: siem`, a hint key for a non-existent objective, and an `answer_from` not starting with `generator.`; `checkObjective(..., " NEON{abc}\n")` true; `"neon{abc}"` false when case-sensitive; `"Alice"` vs `"alice"` true when `case_sensitive: false`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(labs): lab schema, seeded rng, generator registry, answer checks`.

---

### Task 6: Progress service, data model, XP and ranks

**Files:**
- Create: `lib/progress/types.ts`, `lib/progress/repo.ts` (interface), `lib/progress/memory-repo.ts`, `lib/progress/file-repo.ts`, `lib/progress/service.ts`, `lib/progress/context.ts`
- Modify: `lib/progress/ranks.ts` (from Phase 0)
- Test: `tests/unit/lib/progress/service.test.ts`, `tests/unit/lib/progress/file-repo.test.ts`

**Data model** (local-first: one JSON file `dataPath("progress.json")` via Phase 0 `createJsonStore`; record shapes mirror spec §11.2 so the hosted-phase `SupabaseProgressRepo` maps 1:1 to tables):
- `LessonProgress { userId; lessonId; status: "in_progress" | "completed"; checksPassed: string[]; completedAt: string | null }` keyed `${userId}:${lessonId}`
- `LabAttempt { id; userId; labId; seed; mode: "practice" | "challenge"; objectivesSolved: string[]; hintsUsed: number; startedAt; expiresAt: string | null; completedAt: string | null; failedAt: string | null }`
- `XpEvent { userId; source; amount; createdAt }` keyed `${userId}:${source}` — the key makes awards idempotent.
- `RankChallenge { id; userId; rank; labAttemptId; status: "active" | "passed" | "failed"; finishedAt: string | null }`
- The `seed` never leaves the server: no route, action or page returns it (the seed + public generator code would reveal answers).

**Interfaces:**
- Consumes: `getLesson`, `getLessons` (Task 1); `loadChecks`, `gradeCheck` (Task 2); `loadLab`, `generateLab`, `checkObjective`, `newSeed` (Task 5); `RANKS`, `OperatorStore`, `getOperatorStore`, `requireOperator`, `createJsonStore`, `dataPath` (Phase 0).
- Produces:
  - `ProgressRepo` with: `getLessonProgress(u, lessonId)`, `listLessonProgress(u)`, `upsertLessonProgress(p)`, `findOpenAttempt(u, labId, mode)` (not completed/failed), `getAttempt(id)`, `createAttempt(a)`, `updateAttempt(id, patch)`, `awardXp(u, source, amount): Promise<boolean>` (false if key already present), `getXpTotal(u)`, `getActiveChallenge(u, rank)`, `getLastFailedChallenge(u, rank)`, `createChallenge(c)`, `updateChallenge(id, patch)`. Implemented by `MemoryProgressRepo` (tests) and `FileProgressRepo` (`constructor(filePath = dataPath("progress.json"))`).
  - `type Ctx = { repo: ProgressRepo; operators: OperatorStore; now: () => Date }` — rank is read from / written to the operator record (`operators.get(id).rank`, `operators.setRank`).
  - `getCtx(): Ctx` in `context.ts` (`import "server-only"`) → `{ repo: new FileProgressRepo(), operators: getOperatorStore(), now: () => new Date() }` — the single swap point for Supabase later.
  - `answerCheck(ctx, userId, lessonId, questionId, optionIndex) → Promise<{ correct: boolean; explanations: string[]; lessonCompleted: boolean }>` — on correct, adds `questionId` to `checks_passed`; then `tryCompleteLesson`.
  - `tryCompleteLesson(ctx, userId, lessonId) → Promise<boolean>` — complete when every check question passed AND (no `lab` OR a completed practice attempt for that lab exists); on completion awards `lesson:<id>` XP = frontmatter `xp`.
  - `startLab(ctx, userId, labId) → Promise<{ attemptId: string; world: World; objectives: { id: string; prompt: string; solved: boolean }[] }>` — reuses `findOpenAttempt(…,"practice")` or creates one with `newSeed()`; returns world from `generateLab`; never returns `answers` or `seed`.
  - `submitObjective(ctx, userId, attemptId, objectiveId, answer) → Promise<{ correct: boolean; labCompleted: boolean }>` — rejects attempts not owned by `userId`; on all solved sets `completed_at`, awards `lab:<labId>` XP = lab `xp`, then `tryCompleteLesson` for every lesson whose `lab` equals `labId`.
  - `getRankSummary(ctx, userId, rank) → Promise<{ lessons: { id; title; status: "not_started"|"in_progress"|"completed" }[]; allLessonsDone: boolean; challenge: ChallengeState }>` (`ChallengeState` from Task 8).
  - `server actions` in `app/(app)/learn/actions.ts` and `app/(app)/labs/actions.ts` call these with `getCtx()` and the user id from `(await requireOperator()).id`.

- [ ] **Step 1: Failing tests** (`MemoryProgressRepo`, fixture lesson with 2 questions + lab, fixture lab):
  - answering q1 correct then q2 wrong → not completed; q2 correct → completed only after the lab is solved.
  - calling `tryCompleteLesson` twice / `submitObjective` for an already-solved objective → `getXpTotal` unchanged after the first award.
  - `startLab` twice → same `attemptId` and deep-equal `world`; result JSON has no `seed`/`answers` keys.
  - `submitObjective` with another user's attempt id → throws `"not found"`.
  - wrong answer → `{ correct: false }`, `objectives_solved` unchanged.
  - `file-repo.test.ts` (temp dir): 10 concurrent `awardXp(u, "lesson:x", 100)` → exactly one returns `true`, `getXpTotal(u) === 100`; data survives a new `FileProgressRepo` instance on the same file.
- [ ] **Step 2:** Run → FAIL. Implement types, memory repo, file repo, service, context. Run → PASS.
- [ ] **Step 3:** Commit `feat(progress): progress service, xp, lab attempts, local file repo`.

---

### Task 7: Lesson reader, Terminal Check UI, terminal lab UI

**Files:**
- Create: `lib/content/mdx.ts`, `app/(app)/learn/core/page.tsx` (rank map), `app/(app)/learn/[lessonId]/page.tsx`, `app/(app)/labs/[labId]/page.tsx`, `components/lesson/LessonBody.tsx`, `components/lesson/DraftBanner.tsx`, `components/lesson/TerminalCheck.tsx`, `components/lesson/LessonNav.tsx`, `components/labs/terminal/TerminalLab.tsx` (client, `dynamic(..., { ssr: false })`), `components/labs/terminal/line-editor.ts`, `components/labs/ObjectivesPanel.tsx`
- Modify: `components/dashboard/CourseMap.tsx` (Rank 0 links to `/learn/core`, shows XP and progress)
- Test: `tests/unit/components/lesson/TerminalCheck.test.tsx`, `tests/unit/components/labs/line-editor.test.ts`

**Interfaces:**
- Consumes: Task 1 loader, Task 2 `toPublicChecks`, Task 4 `createShell`, Task 6 actions.
- Produces:
  - `renderLesson(lesson: Lesson): Promise<ReactElement>` — `@mdx-js/mdx` `evaluate` with `remark-gfm` and components `{ TerminalCheck, LabLink, Callout }`. Lesson MDX uses `<TerminalCheck />` (no props; the page injects the lesson's public checks + `answerCheck` action) under `## Terminal Check` and `<LabLink />` under `## Lab`.
  - `<TerminalLab world: World />` and `<ObjectivesPanel objectives: {id; prompt; solved}[]; onSubmit(objectiveId: string, answer: string): Promise<{ correct: boolean }> />` — reused by the challenge page (Task 8) with `submitChallengeObjective`.
  - `createLineEditor(): { feed(data: string): { echo: string; submitted?: string; clear?: boolean; recall?: "prev"|"next" } }` — handles printable chars, Backspace (`\x7f`), Enter (`\r`), Ctrl+C (`\x03` → `^C` + new prompt), Ctrl+L (`\x0c`), arrow up/down (`\x1b[A`/`\x1b[B`) for history.
- UI rules: lesson page opens with a `HeroBand` (lesson title in Hacked); in the body `##` headings use Hacked, `###` use Pixel Operator, prose stays `font-sans` (Phase 0 theme roles); lesson column `max-w-[72ch]`; code/ASCII diagrams in `font-mono` with horizontal scroll inside the block only; `DraftBanner` when `status !== "published"`; Terminal Check shows per-option explanations after answering and allows retry; lab page = briefing + `TerminalLab` + `ObjectivesPanel` (one input per objective, submit → `submitObjective`), and on viewports < 768px a notice "Labs work best on a laptop" (still usable). Completion toast shows XP gained.

- [ ] **Step 1: Failing tests:** `TerminalCheck` renders options as radio buttons, posts the chosen index, then shows "Correct"/"Not quite" and every explanation returned; `line-editor` — feeding `"l","s","\x7f","s","\r"` yields `submitted: "ls"`; `"\x03"` resets the buffer.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Manual: `NEON_SHOW_DRAFTS=true npm run dev`, open a fixture lesson on desktop and at 375px; run commands in a lab.
- [ ] **Step 4:** Commit `feat(learn): MDX lesson reader, terminal checks, terminal lab UI`.

---

### Task 8: Rank challenge (timed, randomized, cooldown)

**Files:**
- Create: `lib/progress/challenge.ts`, `app/(app)/challenge/[rank]/page.tsx`, `app/(app)/challenge/actions.ts`, `components/challenge/ChallengeTimer.tsx`
- Test: `tests/unit/lib/progress/challenge.test.ts`

**Interfaces:**
- Consumes: Task 5 lab loading (lab with `challenge.rank === rank`), Task 6 repo + `getRankSummary`.
- Produces:
  - `type ChallengeState = { kind: "locked" } | { kind: "ready" } | { kind: "active"; attemptId: string; expiresAt: string } | { kind: "cooldown"; retryAt: string } | { kind: "passed" }`
  - `challengeState(input: { allLessonsDone: boolean; passed: boolean; active?: { attemptId; expiresAt: Date }; lastFailedAt?: Date; cooldownMinutes: number; now: Date }): ChallengeState` — pure; an `active` past `expiresAt` is reported as `cooldown` from `expiresAt`.
  - `startChallenge(ctx, userId, rank)` — only from `ready`; new `challenge`-mode attempt with fresh seed, `expires_at = now + time_limit_minutes`.
  - `submitChallengeObjective(ctx, userId, attemptId, objectiveId, answer)` — if `now > expires_at`: mark attempt `failed_at = expires_at`, challenge `failed`, return `{ expired: true }`. When all objectives solved in time: challenge `passed`, `ctx.operators.setRank(userId, rank + 1)`, award `challenge:core-r<rank>` XP.
  - `abandonChallenge(ctx, userId, attemptId)` → failed now (cooldown starts).
- Rank 0 values: `time_limit_minutes: 45`, `cooldown_minutes: 30` (in the challenge `lab.yaml`; owner may tune).

- [ ] **Step 1: Failing tests:** `challengeState` → `locked` when lessons not done; `ready`; `active`; past expiry → `{kind:"cooldown", retryAt: expiresAt+30m}`; after `lastFailedAt+30m` → `ready`; `passed` wins over everything. Service: submit after expiry (inject `now`) returns `{ expired: true }` and rank unchanged; full solve in time → `(await ctx.operators.get(userId)).rank === 1`, second solve attempt doesn't double XP; a retry after cooldown gets a different seed/world.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Page: state-driven UI; `ChallengeTimer` counts down from server `expiresAt` (display only); on pass shows a promotion screen "Rank 1 · Operator unlocked".
- [ ] **Step 4:** Commit `feat(challenge): timed randomized rank challenge with cooldown`.

---

### Task 9: Content CI checks and coverage matrix

**Files:**
- Create: `scripts/check-content.ts`, `lib/content/validate.ts`, `content/coverage/core.yaml`
- Modify: `package.json` (`"check:content": "tsx scripts/check-content.ts"`), `.github/workflows/ci.yml` (run it after unit tests)
- Test: `tests/unit/lib/content/validate.test.ts`

**Coverage format:**
```yaml
built_ranks: [0]          # objectives targeted at these ranks must have ≥1 lesson
certs:
  secplus: { name: "CompTIA Security+", exam: "SY0-701" }
  netplus: { name: "CompTIA Network+",  exam: "N10-009" }
  aplus:   { name: "CompTIA A+",        exam: "220-1201/1202" }
objectives:
  - id: "secplus:1.1"
    summary: "<own-words summary, not vendor text>"
    target_rank: 2
```
(Exam codes: confirm current versions against the official CompTIA objective PDFs when filling this in.)

**Interfaces:**
- Produces: `validateContent(input: { lessons: Lesson[]; checks: Map<string, CheckSet>; labs: Lab[]; coverage: Coverage; runLessonCommands: (lesson) => string[] }): string[]` (list of human-readable errors; script exits 1 if non-empty). Rules:
  1. Body has `## Briefing`, `### 1.`…`### 7.` in order, then `### Remember it like this` and `### Interview answer`, `## Terminal Check`, `## Lab`, `## Debrief`.
  2. Every lesson has a checks file; `lab` (if set) exists in `labs/`.
  3. Every `objectives_covered` id exists in coverage; every objective with `target_rank` in `built_ranks` is covered by ≥1 lesson.
  4. Every line starting with `$ ` inside a ```` ```console ```` block runs in `createShell` against the lesson's lab world (seed `"content-check"`) or a default demo world, and never exits 127 (command not found) or with a parse error.
  5. `last_reviewed` older than 12 months → warning (not failure).

- [ ] **Step 1: Failing tests:** each rule with a minimal bad fixture produces an error naming the lesson id; a good fixture produces `[]`.
- [ ] **Step 2:** Run → FAIL. Implement + script. Run → PASS.
- [ ] **Step 3:** Commit `feat(content): content validation script and core coverage matrix`.

---

### Task 10: Rank 0 labs, generators and solve tests

**Files:**
- Create: `labs/core-r0-files-lab-01/{lab.yaml,briefing.md}`, `labs/core-r0-terminal-lab-01/{lab.yaml,briefing.md}`, `labs/core-r0-challenge-01/{lab.yaml,briefing.md}`, `lib/generators/terminal/files-perms.ts`, `lib/generators/terminal/first-terminal.ts`, `lib/generators/terminal/r0-challenge.ts`, `lib/generators/terminal/base-world.ts` (shared realistic Linux skeleton: `/etc/hostname`, `/etc/passwd`, `/home/<user>`, `/var/log`, `/tmp`)
- Test: `tests/labs/core-r0-files-lab-01.test.ts`, `tests/labs/core-r0-terminal-lab-01.test.ts`, `tests/labs/core-r0-challenge-01.test.ts` (add `tests/labs/**` to Vitest include)

**Lab designs** (all values from the seeded rng; usernames from a fixed list of Indian + international first names; hostnames like `neon-<word>-<nn>`):
- `core-r0-files-lab-01` (lesson 2): o1 "Which file in `~/shared` can you NOT read?" (one file mode `0o600` owned by another user; answer = filename); o2 "Find the flag in the file only the owner can write but everyone can read" (`0o644`, flag inside). xp 100.
- `core-r0-terminal-lab-01` (lesson 4): o1 flag in a hidden file in home (`ls -a`, `cat`); o2 flag at the end of a 300-line log (`tail`); o3 "How many lines in `/var/log/app.log` contain ERROR?" (`grep -c`). xp 150.
- `core-r0-challenge-01` (`challenge: {rank: 0, time_limit_minutes: 45, cooldown_minutes: 30}`): "Night shift" scenario — o1 which username has the most `Failed password` lines in `/var/log/auth.log` (case-insensitive); o2 flag in a file the learner must find in a directory they can enter but not list (mode `0o711`) using a filename leaked in `~/notes.txt`; o3 count of IPs in an allow-list file. xp 300.

- [ ] **Step 1: Failing solve tests** — pattern for each lab, two different seeds:
```ts
for (const seed of ["seed-a", "seed-b"]) test(`solves with seed ${seed}`, async () => {
  const lab = await loadLab("core-r0-terminal-lab-01");
  const { world, answers } = generateLab(lab, seed);
  const sh = createShell(world);
  const hidden = sh.exec("ls -a ~").stdout.split(/\s+/).find(n => n.startsWith(".") && n.length > 2 && n !== ".bashrc")!;
  const flag1 = sh.exec(`cat ~/${hidden}`).stdout.match(/NEON\{[0-9a-f]{12}\}/)![0];
  expect(checkObjective(lab, answers, "o1", flag1)).toBe(true);
  // o2 via `tail -n 1 …`, o3 via `grep -c ERROR …` — same shape
});
test("different seeds give different answers", …);
```
The test only uses shell output to find answers — never reads `answers` except to check.
- [ ] **Step 2:** Run → FAIL. Implement generators + yaml + briefings (briefings in plain language with the lab's scenario and the authorization note "this machine is a simulation you are allowed to explore"). Run → PASS. Hints: 2–3 graduated hints per objective, last hint names the command but never the answer.
- [ ] **Step 3:** Commit `feat(labs): rank 0 terminal labs, challenge, generators with solve tests`.

---

### Task 11: Rank 0 lessons (draft content)

**Files:** in `content/core/rank-0/`, each `NN-<slug>.mdx` + `NN-<slug>.checks.yaml`; update `content/coverage/core.yaml` with the objectives they cover.

| # | id | title | lab | Debrief incident (verify details from primary sources while writing) |
|---|---|---|---|---|
| 1 | `core-r0-comp-hardware-01` | What a Computer Really Is | — | Spectre/Meltdown (2018): CPU design flaws leaking memory |
| 2 | `core-r0-comp-os-files-01` | Operating Systems, Files and Permissions | `core-r0-files-lab-01` | WannaCry (2017): unpatched OS + file encryption |
| 3 | `core-r0-net-internet-01` | How the Internet Works | — | Mirai botnet / Dyn DNS outage (2016) |
| 4 | `core-r0-term-first-terminal-01` | Your First Terminal | `core-r0-terminal-lab-01` | Shellshock (2014): a bug in the bash shell itself |
| 5 | `core-r0-mind-attacker-defender-01` | Thinking Like a Defender vs an Attacker | — | Target (2013): alerts fired but weren't acted on |
| 6 | `core-r0-career-ethics-law-01` | Cyber Careers Map + Ethics & Law | — | AIIMS Delhi ransomware (2022) |

Rules for every lesson: full CLAUDE.md template; `track: core`, `rank: 0`, `order` = #, `estimated_minutes` 20–35, `xp: 100`, `status: draft`, `last_reviewed: null`; analogy first, then full depth, every term defined on first use; section 4 lists ATT&CK IDs only where truly relevant (e.g. lesson 2 T1486 Data Encrypted for Impact; lesson 3 T1498 Network Denial of Service; lesson 4 T1059.004 Unix Shell); commands only inside ```` ```console ```` blocks with `$ ` prompts using engine-supported commands; lessons without a lab use `## Lab` for an unscored "Field exercise" (e.g. lesson 3: trace what happens when you open a website, step list to fill in). Lesson 6 covers IT Act 2000 (ss. 43, 66, 66C, 66D, 72A as applicable) and DPDP Act 2023 in own words with a "not legal advice" note, and links the careers map to the four launch tracks (Cybersecurity (Purple Team), SOC Analyst, Penetration Tester / VAPT, Cloud Security). Each checks file: 4 questions (basic, conceptual, practical or scenario, security). Every lesson follows `docs/curriculum/teaching-style.md`: 5-second answer first, analogy then real meaning, commands in the explained format, a "Remember it like this" anchor and an interview answer.

- [ ] **Step 1:** Write lessons 1–2 + checks; `npm run check:content` → PASS; read them rendered at 375px.
- [ ] **Step 2:** Lessons 3–4 + checks; `npm run check:content` → PASS.
- [ ] **Step 3:** Lessons 5–6 + checks; `npm run check:content` → PASS.
- [ ] **Step 4:** Commit `content(core): rank 0 lessons (draft, pending expert review)`.

---

### Task 12: End-to-end — a new user completes Rank 0

**Files:**
- Create: `tests/e2e/rank-0.spec.ts`, `tests/e2e/helpers/terminal.ts`, `tests/e2e/helpers/checks.ts`
- Modify: `playwright.config.ts` (`webServer.env.NEON_SHOW_DRAFTS = "true"`), CI e2e job env

**Interfaces:**
- Produces: `runCommand(page, cmd): Promise<string>` — types into the xterm, presses Enter, returns new text from `.xterm-rows` after the prompt reappears. `answerAllChecks(page)` — for each question tries options in order until "Correct" (uses the UI only; no answer keys in tests).

- [ ] **Step 1: Write the test** (desktop project): fresh browser context → `/start` (handle + agreement) → `/learn/core` → for each of the 6 lessons open it, `answerAllChecks`, and if it has a lab solve it via `runCommand` with the same command recipes as Task 10 → `/learn/core` shows 6/6 complete → `/challenge/0` start → solve 3 objectives → promotion screen → `/dashboard` shows "Operator" and XP = 1150 (6×100 lessons + 100 + 150 labs + 300 challenge). Mobile project: open lesson 1 at Pixel 7 and assert no horizontal page scroll and the lesson heading visible.
- [ ] **Step 2:** `npm run test:e2e` → PASS. Also run `npm run lint && npm run typecheck && npm test && npm run check:content && npm run build` → all exit 0.
- [ ] **Step 3:** Commit `test(e2e): new user completes rank 0`.
- [ ] **Step 4:** Owner gate: Rank 0 lessons stay `draft` until a human expert reviews them (CLAUDE.md); list them for review in the PR description.

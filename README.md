# NEON — Cybersecurity Learning Platform

A text-first, hacker-themed platform that takes anyone from zero to a job-ready cybersecurity professional. "NEON" is a placeholder codename.

- Source of truth: [`docs/specs/2026-10-06-platform-design.md`](docs/specs/2026-10-06-platform-design.md)
- Curriculum roadmaps, teaching style and cert targets: [`docs/curriculum/`](docs/curriculum/)
- Implementation plans per phase: [`docs/plans/`](docs/plans/)
- Rules for contributors and AI agents: [`CLAUDE.md`](CLAUDE.md)

## Run it locally

Requires **Node 24** (see `.nvmrc`).

```bash
npm install
cp .env.example .env.local      # Windows PowerShell: copy .env.example .env.local
npm run dev                     # http://localhost:3000
```

Open http://localhost:3000, press **Start**, choose a handle, accept the ethical-use agreement, and you land on the dashboard.

### Local data

This phase is local-first: there is no login or database yet. Each browser gets an operator id in an httpOnly cookie (`neon_uid`), and operator records are stored as JSON in `.data/` (git-ignored; change with `NEON_DATA_DIR`).

- **Reset everything:** stop the server and delete the `.data/` folder. Browsers with an old cookie are sent back to `/start` automatically.
- **Switch operator:** use the button in the top bar (your data stays on disk).

Supabase Auth, Postgres and deployment are added at the start of Phase 2 (spec §14), behind the same store interfaces (`lib/identity/operator-store.ts`).

## Tests

```bash
npm run lint
npm run typecheck     # runs `next typegen` first (Next 16 route types)
npm test              # Vitest unit + component tests
npm run test:e2e      # Playwright, desktop + mobile; builds and serves on :3000 with NEON_DATA_DIR=.data-e2e
```

Stop any dev server on port 3000 before `npm run test:e2e`, or it will be reused with your local data.

## Credits

- **Hacked** font by David Libeau — https://hackedfont.com (CC-BY)
- **Pixel Operator** font by Jayvee Enaguas (CC0)

Licences: [`public/fonts/LICENSES.md`](public/fonts/LICENSES.md).

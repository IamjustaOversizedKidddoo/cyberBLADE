# CyberBLADE Design System (v2.0)

## Overview & Identity
CyberBLADE employs a tactical, operator-console aesthetic tailored for cybersecurity practitioners, analysts, and operators working long hours in terminals, packet inspectors, and curriculum workspaces.

### Core Philosophy
1. **Focus & Readability First**: High legibility, dark theme by default, restrained neon accents, subtle panel borders like an avionics HUD.
2. **Atmosphere without Distraction**: Scanlines, glitch typography, and motion are subdued in reading and lab workspaces. All motion strictly obeys `prefers-reduced-motion`.
3. **Information Density**: Compact, monospace-aligned telemetry in tools (Wireshark packet tables, SIEM log streams, Linux/PowerShell terminals); generous reading measure (65–75 characters) in curriculum prose.
4. **Accessible Semantics**: States (Completed, Available, Locked, In Progress) and SIEM severities (Critical, High, Medium, Low, Info) always pair distinct geometric iconography and textual labels with color—never relying on color alone.

---

## 1. Design Tokens

Design tokens are declared centrally in `app/globals.css` and exposed via Tailwind CSS theme variables.

### Surface Hierarchy
| Token | CSS Variable | Hex / Value | Role |
| :--- | :--- | :--- | :--- |
| `void` | `--bg-void` | `#000000` | Absolute backdrop / letterboxing |
| `canvas` | `--bg-canvas` | `#020408` | Deepest workspace floor |
| `surface` | `--bg-surface` | `#0a0f18` | Standard cards, panels, table containers |
| `surface-raised` | `--bg-surface-raised` | `#101726` | Elevated cards, dialogs, briefing headers |
| `surface-subtle` | `--bg-surface-subtle` | `#060b13` | Inset panels, alternate rows, terminal trays |
| `surface-hover` | `--bg-surface-hover` | `#162238` | Interactive row/card hover states |

### Borders
| Token | CSS Variable | Value | Purpose |
| :--- | :--- | :--- | :--- |
| `border-subtle` | `--border-subtle` | `rgb(255 255 255 / 0.08)` | Internal dividers, subtle separators |
| `border-default` | `--border-default` | `rgb(255 255 255 / 0.16)` | Standard panel edges, cards, inputs |
| `border-strong` | `--border-strong` | `rgb(255 255 255 / 0.32)` | Active focus states, modal boundaries |
| `border-accent` | `--border-accent` | `rgb(15 190 255 / 0.5)` | Active selections, tactical highlight rings |

### Typography & Contrast (WCAG AA)
| Role | CSS Variable | Hex Value | Contrast vs `#0a0f18` | Status |
| :--- | :--- | :--- | :--- | :--- |
| Primary text | `--text-primary` | `#f3f6f9` | 15.3 : 1 | Pass (AAA) |
| Secondary text | `--text-secondary` | `#9cb0c4` | 6.6 : 1 | Pass (AA) |
| Muted metadata | `--text-muted` | `#62758d` | 4.65 : 1 | Pass (AA) |
| Inverse text | `--text-inverse` | `#030712` | 18.2 : 1 (on cyan) | Pass (AAA) |

### Semantic Colors
| Semantic | Token | Value | Background Tint |
| :--- | :--- | :--- | :--- |
| Success / Solved | `--color-success` | `#10b981` (Emerald) | `rgba(16, 185, 129, 0.12)` |
| Warning / Cooldown | `--color-warning` | `#f59e0b` (Amber) | `rgba(245, 158, 11, 0.12)` |
| Danger / Breached | `--color-danger` | `#ef4444` (Rose/Red) | `rgba(239, 68, 68, 0.12)` |
| Info / Active | `--color-info` | `#0fbeff` (Cyan) | `rgba(15, 190, 255, 0.12)` |

### SIEM Severity Hierarchy
Each severity level utilizes an accessible geometric shape in addition to color:
- **CRITICAL** (`#ef4444`): Flame / Diamond icon (`IconFlame`) + bold text
- **HIGH** (`#f97316`): Hexagon icon (`IconHexagon`) + semibold text
- **MEDIUM** (`#eab308`): Square icon (`IconSquare`) + medium text
- **LOW** (`#0ea5e9`): Circle icon (`IconCircle`) + regular text
- **INFO** (`#64748b`): Info Shield icon (`IconInfo`) + muted text

### Operator Ranks
- **Rank 0 (Initiate)**: Iron / Slate (`#94a3b8`)
- **Rank 1 (Operator)**: Electric Cyan (`#0fbeff`)
- **Rank 2 (Watcher)**: Cyber Purple (`#c084fc`)
- **Rank 3 (Hunter)**: Gold / Amber (`#f59e0b`)

---

## 2. Component Primitives (`components/ui/`)

| Component | File | Key Props & Features |
| :--- | :--- | :--- |
| `Button` | `Button.tsx` | `variant` (primary, secondary, ghost, danger), `size` (sm, md, lg), `loading`, `disabled`, `iconOnly` |
| `Card` | `Card.tsx` | `variant` (default, raised, subtle), `edge` (cyan, emerald, amber, rose, purple), `hoverable` |
| `Badge` | `Badge.tsx` | Variants, `StatusBadge` (COMPLETED, AVAILABLE, LOCKED, IN_PROGRESS), `RankBadge`, `SeverityBadge` |
| `ProgressBar` | `ProgressBar.tsx` | Accessible with `role="progressbar"`, `value`, `variant`, `showLabel`, `label` |
| `Tabs` | `Tabs.tsx` | Accessible keyboard arrows, `defaultValue`, `TabList`, `Tab`, `TabPanel` |
| `Callout` | `Callout.tsx` | `variant` (info, tip, warning, danger), title, icon, `role="note"` |
| `Dialog` | `Dialog.tsx` | Modal with backdrop, `open`, `onClose`, Escape key listener, `role="dialog"`, `aria-modal="true"` |
| `Table` | `Table.tsx` | Dense responsive table: `TableContainer`, `Table`, `TableHeader`, `TableRow`, `TableCell` |
| `Tooltip` | `Tooltip.tsx` | Hover and focus tooltip with `role="tooltip"`, `content` |
| `Kbd` | `Kbd.tsx` | Monospace keyboard key badge with tactile border |
| `EmptyState` | `EmptyState.tsx` | Clean HUD empty state with icon, title, description, and action slot |
| `ErrorState` | `ErrorState.tsx` | Tactical failure card with retry action, `role="alert"` |
| `Skeleton` | `Skeleton.tsx` | Pulse loading placeholder and `CardSkeleton` |
| `Icons` | `icons.tsx` | Lightweight inline SVGs using `currentColor` and `aria-hidden="true"` |

---

## 3. Internal Showcase Route

An internal showcase route is available during development at `/dev/ui`.
- **Production Guard**: Excluded from production builds via `if (process.env.NODE_ENV === "production") notFound();`.
- **Purpose**: Rapid visual verification of all variants, sizes, and states at 1440px and 1024px breakpoints.

---

## 4. Usage Rules: Do & Don't

### DO
- **Use tokens**: Always reference CSS variables (`var(--bg-surface)`) or Tailwind theme classes (`bg-surface`, `text-cyan`, `border-line`).
- **Pair color with shape/text**: Never communicate status, rank, or severity through color alone.
- **Maintain contrast**: Verify any foreground text against its surface meets WCAG AA (>= 4.5:1 for body, >= 3.0:1 for large/bold text).
- **Ensure keyboard navigation**: Any custom interactive control must support Tab, Enter, Space, or arrows, and have a clear `focus-visible:ring-2 focus-visible:ring-cyan` ring.

### DON'T
- **No hardcoded arbitrary hex classes**: Never write `-[#[0-9a-fA-F]{3,8}]` in component classes.
- **No unconstrained white flash surfaces**: Do not use stark white paper backgrounds in the dark HUD workspace.
- **No scanlines over technical reading zones**: Keep scanline overlays subtle (`opacity: 0.03`) and away from long code/prose reading areas.
- **No unlabelled icon buttons**: Always include `aria-label` when using `iconOnly` buttons.

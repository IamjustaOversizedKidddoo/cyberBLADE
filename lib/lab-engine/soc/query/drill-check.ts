import "server-only";

/**
 * Server-side checking for the BladeQL practice drills page. The reference query never leaves
 * the server: learners get the prompt, method-only hints (which commands the drill needs, never
 * their arguments) and a preview of their OWN query's results. An answer is correct when its
 * result rows match the reference rows on the reference's fields (in order when the reference
 * sorts, otherwise as a multiset). That is stricter than verifyDrillQuery's row-count check.
 */
import { BLADEQL_DRILLS, DRILL_SYNTHETIC_DATASET, type BladeQLDrill } from "./drills";
import { executeBladeQL } from "./engine";
import type { BladeQLEvent } from "./types";

// The drill lake is one fixed day; a fixed "now" keeps relative-time functions deterministic.
const DRILL_NOW = Date.parse("2026-10-12T23:59:59Z");
export const PREVIEW_ROWS = 25;

export interface PublicDrill {
  id: string;
  order: number;
  title: string;
  category: BladeQLDrill["category"];
  prompt: string;
  hints: string[];
}

export interface DrillCheckResult {
  correct: boolean;
  message: string;
  preview: { fields: string[]; rows: Array<Record<string, string>>; total: number } | null;
}

/** Pipe commands used by a query (the word after each `|`). */
export function pipeCommands(query: string): string[] {
  return [...new Set([...query.matchAll(/\|\s*([a-z_]+)/gi)].map((m) => m[1].toLowerCase()))];
}

function methodHints(d: BladeQLDrill): string[] {
  const cmds = pipeCommands(d.referenceQuery);
  return [
    "Start with a search that narrows the events to the right log source, then check the row count.",
    cmds.length
      ? `This drill needs these pipe commands, in some order: ${cmds.join(", ")}.`
      : "This drill needs no pipe commands: a search expression alone is enough.",
  ];
}

export function publicDrills(): PublicDrill[] {
  return BLADEQL_DRILLS.map((d) => ({ id: d.id, order: d.order, title: d.title, category: d.category, prompt: d.prompt, hints: methodHints(d) }));
}

export function getPublicDrill(id: string): PublicDrill | null {
  return publicDrills().find((d) => d.id === id) ?? null;
}

export function drillIds(): string[] {
  return BLADEQL_DRILLS.map((d) => d.id);
}

const cell = (v: BladeQLEvent[string]): string => (v === null || v === undefined ? "" : String(v));

function rowKeys(events: BladeQLEvent[], fields: string[]): string[] {
  return events.map((e) => JSON.stringify(fields.map((f) => cell(e[f]))));
}

/** Learner rows compared on the reference's fields; order matters only when the reference sorts. */
export function sameResults(refQuery: string, ref: { events: BladeQLEvent[]; fields: string[] }, got: { events: BladeQLEvent[]; fields: string[] }): boolean {
  if (ref.events.length !== got.events.length) return false;
  // Compare on the columns the reference shows (a column the learner dropped compares as empty and fails).
  const fields = ref.fields.filter((f) => f !== "_raw");
  const a = rowKeys(ref.events, fields);
  const b = rowKeys(got.events, fields);
  if (/\|\s*(sort|head|tail|dedup)\b/i.test(refQuery)) return a.every((k, i) => k === b[i]);
  return [...a].sort().join("\n") === [...b].sort().join("\n");
}

export function checkDrillAnswer(drillId: string, query: string): DrillCheckResult {
  const drill = BLADEQL_DRILLS.find((d) => d.id === drillId);
  if (!drill) return { correct: false, message: "Unknown drill.", preview: null };
  let got;
  try {
    got = executeBladeQL(query, DRILL_SYNTHETIC_DATASET, { scenarioNowEpochMs: DRILL_NOW });
  } catch (err) {
    return { correct: false, message: `Query error: ${err instanceof Error ? err.message : "could not run the query"}`, preview: null };
  }
  const ref = executeBladeQL(drill.referenceQuery, DRILL_SYNTHETIC_DATASET, { scenarioNowEpochMs: DRILL_NOW });
  const fields = got.fields.filter((f) => f !== "_raw");
  const preview = {
    fields,
    rows: got.events.slice(0, PREVIEW_ROWS).map((e) => Object.fromEntries(fields.map((f) => [f, cell(e[f])]))),
    total: got.events.length,
  };
  if (sameResults(drill.referenceQuery, ref, got)) return { correct: true, message: "Correct: your results match.", preview };
  const message =
    got.events.length !== ref.events.length
      ? `Not yet: your query returned ${got.events.length} row${got.events.length === 1 ? "" : "s"}, which is not the expected number.`
      : "Not yet: the row count is right, but the rows or their order are not.";
  return { correct: false, message, preview };
}

/** The practice lake, as learners see it (raw lines plus the field names they can query). */
export function drillDatasetView(): { fields: string[]; lines: string[] } {
  const fields = [...new Set(DRILL_SYNTHETIC_DATASET.flatMap((e) => Object.keys(e)))].filter((f) => f !== "_raw" && f !== "id").sort();
  return { fields, lines: DRILL_SYNTHETIC_DATASET.map((e) => `${e.timestamp}  ${e._raw}`) };
}

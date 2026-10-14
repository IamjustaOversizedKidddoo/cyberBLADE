"use client";

import { useId, useState } from "react";
import type { DrillCheckResult, PublicDrill } from "@/lib/lab-engine/soc/query/drill-check";

type Run = (query: string) => Promise<DrillCheckResult>;

/** One BladeQL drill: write a query, run it on the server, see your own rows and a verdict. */
export function DrillRunner({ drill, run }: { drill: PublicDrill; run: Run }) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DrillCheckResult | null>(null);
  const [error, setError] = useState("");
  const [hintsShown, setHintsShown] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError("Write a query first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setResult(await run(query));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Could not run your query. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const status = error || result?.message || "";
  const correct = result?.correct === true;
  return (
    <form onSubmit={submit} data-drill={drill.id} className="space-y-3 rounded-sm border border-cyan/40 bg-surface p-4">
      <label htmlFor={`${uid}-q`} className="block font-sans text-[15px] font-semibold text-ink">
        Your query
      </label>
      <textarea
        id={`${uid}-q`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
        rows={3}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={`${uid}-help`}
        className="w-full rounded-xs border border-line bg-surface-subtle p-3 font-mono text-[14px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      />
      <p id={`${uid}-help`} className="font-sans text-[13px] text-muted">
        Ctrl+Enter (or Cmd+Enter) runs the query.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-xs border border-cyan/60 bg-cyan/10 px-4 font-mono text-[13px] font-bold text-cyan transition-colors duration-150 hover:bg-cyan/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Running…" : "Run and check"}
        </button>
        {hintsShown < drill.hints.length && (
          <button
            type="button"
            onClick={() => setHintsShown((h) => h + 1)}
            className="min-h-[44px] rounded-xs border border-line px-3 font-mono text-[13px] text-muted transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            Show a hint ({hintsShown + 1} of {drill.hints.length})
          </button>
        )}
      </div>
      {hintsShown > 0 && (
        <ul className="space-y-1">
          {drill.hints.slice(0, hintsShown).map((h, i) => (
            <li key={i} className="rounded-xs border-l-2 border-warning/70 bg-surface-subtle px-3 py-1.5 font-sans text-[13px] text-muted">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-warning">Hint {i + 1}: </span>
              {h}
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className={`font-sans text-[14px] ${correct ? "text-success" : error ? "text-danger" : "text-muted"}`}>
        {status && (
          <>
            <span className="font-mono font-bold">{correct ? "✓ " : "✗ "}</span>
            {status}
          </>
        )}
      </p>
      {result?.preview && (
        <div>
          <p className="mb-1 font-mono text-[12px] text-muted">
            Your results: {result.preview.total} row{result.preview.total === 1 ? "" : "s"}
            {result.preview.total > result.preview.rows.length ? ` (first ${result.preview.rows.length} shown)` : ""}
          </p>
          <div tabIndex={0} role="region" aria-label="Results of your query (scrolls sideways)" className="overflow-x-auto rounded-xs border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
            <table className="w-full border-collapse text-left font-mono text-[12px]">
              <thead>
                <tr>
                  {result.preview.fields.map((f) => (
                    <th key={f} scope="col" className="border-b border-line bg-surface-raised px-2 py-1.5 font-semibold text-muted">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.preview.rows.map((r, i) => (
                  <tr key={i}>
                    {result.preview!.fields.map((f) => (
                      <td key={f} className="whitespace-nowrap border-b border-line/40 px-2 py-1 text-ink">
                        {r[f]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}

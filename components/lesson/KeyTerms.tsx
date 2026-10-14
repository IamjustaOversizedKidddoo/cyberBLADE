/** Key terms for the lesson. Each term gets a stable anchor the glossary and tooltips link to. */
export function termAnchor(term: string): string {
  return `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function KeyTerms({ terms }: { terms: Array<{ term: string; definition: string }> }) {
  return (
    <dl className="not-prose my-6 divide-y divide-line rounded-sm border border-line bg-surface">
      {terms.map((t) => (
        <div key={t.term} id={termAnchor(t.term)} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="font-mono text-[13px] font-bold text-ink">{t.term}</dt>
          <dd className="font-sans text-[14px] leading-relaxed text-muted">{t.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

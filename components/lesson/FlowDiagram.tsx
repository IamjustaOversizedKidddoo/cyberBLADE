/**
 * Accessible process diagram. The steps ARE the text alternative: an ordered list that screen
 * readers announce, that reflows to a single column at phone widths, and whose boxes keep visible
 * borders in forced-colours mode. Arrows are decorative.
 */
export interface FlowStep {
  label: string;
  detail?: string;
}

export function FlowDiagram({
  title,
  description,
  steps,
  loopBackLabel,
}: {
  title: string;
  description: string;
  steps: FlowStep[];
  /** When set, the diagram shows that the last step returns to the first (a loop). */
  loopBackLabel?: string;
}) {
  const id = `fig-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <figure data-flow-diagram aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} className="not-prose my-8 rounded-sm border border-line bg-surface p-4">
      <figcaption>
        <span id={`${id}-title`} className="block font-mono text-[12px] font-bold uppercase tracking-wider text-ink">
          Diagram: {title}
        </span>
        <span id={`${id}-desc`} className="mt-1 block font-sans text-[13px] leading-relaxed text-muted">
          {description}
        </span>
      </figcaption>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className="relative rounded-xs border border-cyan/40 bg-surface-subtle p-3 forced-colors:border-[CanvasText]"
          >
            <span className="block font-mono text-[11px] text-muted">Step {i + 1}</span>
            <span className="block font-sans text-[14px] font-semibold text-ink">{s.label}</span>
            {s.detail && <span className="mt-1 block font-sans text-[13px] leading-snug text-muted">{s.detail}</span>}
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-cyan sm:hidden">
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
      {loopBackLabel && (
        <p className="mt-3 flex items-center gap-2 font-sans text-[13px] text-muted">
          <span aria-hidden="true" className="text-cyan">
            ↺
          </span>
          {loopBackLabel}
        </p>
      )}
    </figure>
  );
}

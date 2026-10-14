import type { ReactNode } from "react";

/**
 * A captioned block for logs, headers and command output. The scroll area is focusable and
 * labelled so keyboard users can scroll long lines (WCAG 2.1.1); text stays real text so it works
 * with screen readers, zoom and forced-colours mode.
 */
export function LogBlock({ title, children, lines }: { title: string; children?: ReactNode; lines?: string[] }) {
  const text = lines ? lines.join("\n") : typeof children === "string" ? children.replace(/^\n+|\n+$/g, "") : children;
  return (
    <figure className="not-prose my-6 overflow-hidden rounded-sm border border-line bg-surface-subtle">
      <figcaption className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-1.5 font-mono text-[12px] text-muted">
        <span>{title}</span>
        <span aria-hidden="true" className="text-[11px] uppercase tracking-wider">
          log
        </span>
      </figcaption>
      <pre
        tabIndex={0}
        role="region"
        aria-label={`${title} (scrolls sideways)`}
        className="overflow-x-auto whitespace-pre p-3 font-mono text-[13px] leading-relaxed text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan forced-colors:border forced-colors:border-[CanvasText]"
      >
        {text}
      </pre>
    </figure>
  );
}

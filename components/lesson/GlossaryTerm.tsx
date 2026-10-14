"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * First-use glossary term: a toggletip. The term is a button; pressing it (or hovering) shows the
 * definition in a live region with a link to the full glossary. Escape or moving away closes it.
 * Hover content stays open while the pointer is over the term or the bubble (WCAG 1.4.13).
 */
export function GlossaryTerm({ term, definition, href, children }: { term: string; definition: string; href: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as globalThis.Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <span ref={wrap} className="relative inline" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-tip`}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help rounded-xs border-b border-dotted border-cyan/70 bg-transparent p-0 [font:inherit] [color:inherit] underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        {children}
        <span className="sr-only"> (glossary term)</span>
      </button>
      <span id={`${id}-tip`} role="status" aria-live="polite">
        {open && (
          <span className="absolute left-0 top-full z-30 mt-1 block w-[min(18rem,80vw)] rounded-sm border border-cyan/50 bg-surface p-3 font-sans text-[13px] font-normal not-italic leading-relaxed text-ink shadow-lg">
            <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-cyan">{term}</span>
            <span className="mt-1 block">{definition}</span>
            <Link href={href} className="mt-2 inline-block text-cyan underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
              Open in glossary
            </Link>
          </span>
        )}
      </span>
    </span>
  );
}

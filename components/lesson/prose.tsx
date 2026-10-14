import type { MDXComponents } from "mdx/types";

/**
 * Lesson typography (CyberBLADE HUD theme):
 * - H2/H3 headings with distinct hierarchy and anchor support
 * - Readable sans prose with comfortable 1.65 line-height and 65-75ch measure
 * - Monospace code blocks with tokenized dark surfaces and horizontal scroll safety
 * - Responsive table containers
 */
export const proseComponents: MDXComponents = {
  h2: (p) => (
    <h2
      className="mb-4 mt-12 text-2xl sm:text-3xl font-display text-ink first:mt-0 tracking-wide border-b border-line/40 pb-2"
      {...p}
    />
  ),
  h3: (p) => (
    <h3
      className="mb-3 mt-8 font-ui text-lg sm:text-xl text-cyan font-semibold tracking-wide"
      {...p}
    />
  ),
  h4: (p) => (
    <h4
      className="mb-2 mt-6 font-ui text-base text-ink font-medium"
      {...p}
    />
  ),
  p: (p) => (
    <p
      className="my-4 font-sans text-base leading-[1.7] text-ink/90"
      {...p}
    />
  ),
  ul: (p) => (
    <ul
      className="my-4 list-disc space-y-1.5 pl-6 font-sans text-base leading-relaxed text-ink/90"
      {...p}
    />
  ),
  ol: (p) => (
    <ol
      className="my-4 list-decimal space-y-1.5 pl-6 font-sans text-base leading-relaxed text-ink/90"
      {...p}
    />
  ),
  li: (p) => (
    <li
      className="text-ink/90"
      {...p}
    />
  ),
  a: (p) => (
    <a
      className="text-cyan underline underline-offset-4 decoration-cyan/40 hover:decoration-cyan transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded-xs"
      {...p}
    />
  ),
  strong: (p) => (
    <strong
      className="font-semibold text-ink"
      {...p}
    />
  ),
  blockquote: (p) => (
    <blockquote
      className="my-6 rounded-r-xs border-l-4 border-l-purple border-y border-r border-line/40 bg-purple/5 p-4 font-sans italic text-muted leading-relaxed"
      {...p}
    />
  ),
  pre: (p) => (
    <div className="relative my-6 overflow-hidden rounded-sm border border-line bg-surface-subtle">
      {/* Focusable, labelled scroll region so keyboard users can scroll long lines (WCAG 2.1.1). */}
      <pre
        tabIndex={0}
        role="region"
        aria-label="Code (scrolls sideways on small screens)"
        className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-ink/90 selection:bg-cyan/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan"
        {...p}
      />
    </div>
  ),
  code: (p) => (
    <code
      className="rounded-xs border border-line/60 bg-surface-raised px-1.5 py-0.5 font-mono text-[0.88em] text-cyan"
      {...p}
    />
  ),
  table: (p) => (
    // Focusable, labelled scroll region so keyboard users can scroll wide tables (WCAG 2.1.1).
    <div
      tabIndex={0}
      role="region"
      aria-label="Table (scrolls sideways on small screens)"
      className="my-6 w-full overflow-x-auto rounded-sm border border-line bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
    >
      <table
        className="w-full border-collapse text-left font-ui text-sm"
        {...p}
      />
    </div>
  ),
  th: (p) => (
    <th
      className="border-b border-line bg-surface-raised px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-xs"
      {...p}
    />
  ),
  td: (p) => (
    <td
      className="border-b border-line/40 px-4 py-2.5 align-top text-ink/90 font-sans text-sm"
      {...p}
    />
  ),
  hr: () => <hr className="my-10 border-line/60" />,
};

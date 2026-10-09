/**
 * CYBERBLADE's mark: an abstract faceted blade on a slight diagonal, with an orbit of two nodes
 * (cyan = defend, pink = attack). Original CYBERBLADE artwork. It is the brand mark (header,
 * footer, certificates) and the fallback wherever the WebGL BladeObject isn't loaded.
 * Decorative unless given a `title`.
 */
export function BladeMark({ title, className = "" }: { title?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      <ellipse cx="60" cy="62" rx="54" ry="18" strokeWidth="1" strokeDasharray="3 5" opacity="0.7" transform="rotate(-18 60 62)" />
      <g transform="rotate(28 60 60)">
        {/* blade: two facets meeting at the spine, tip at the top */}
        <path d="M60 4 L71 70 L60 82 Z" fill="currentColor" opacity="0.18" />
        <path d="M60 4 L49 70 L60 82 L71 70 Z" strokeWidth="2.5" />
        <path d="M60 4 V82 M53 40 L60 46 L67 40" strokeWidth="1.2" />
        {/* guard and grip */}
        <path d="M38 80 H82 L78 87 H42 Z" strokeWidth="2.5" fill="currentColor" />
        <path d="M56 87 H64 L62 112 H58 Z" strokeWidth="2.5" />
        <path d="M57 95 H63 M57 102 H63" strokeWidth="1.2" />
      </g>
      <circle cx="14" cy="76" r="3.5" fill="var(--color-cyan)" stroke="none" />
      <circle cx="107" cy="46" r="3.5" fill="var(--color-pink)" stroke="none" />
    </svg>
  );
}

type Props = { as?: "h1" | "h2" | "span"; children: string; className?: string };

/**
 * Hacked-font heading with a CSS-only RGB-split glitch on first paint and hover.
 * The two coloured copies are real aria-hidden spans: CSS ::before/::after content
 * would be read out as part of the heading's accessible name.
 */
export function GlitchText({ as: Tag = "h2", children, className }: Props) {
  return (
    <Tag className={`neon-glitch font-display ${className ?? ""}`} data-glitch="intro">
      {children}
      <span aria-hidden="true" className="neon-glitch-copy neon-glitch-cyan">
        {children}
      </span>
      <span aria-hidden="true" className="neon-glitch-copy neon-glitch-pink">
        {children}
      </span>
    </Tag>
  );
}

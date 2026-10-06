type Props = { as?: "h1" | "h2" | "span"; children: string; className?: string };

/** Hacked-font heading with a CSS-only RGB-split glitch on first paint and hover. */
export function GlitchText({ as: Tag = "h2", children, className }: Props) {
  return (
    <Tag className={`neon-glitch font-display ${className ?? ""}`} data-text={children} data-glitch="intro">
      {children}
    </Tag>
  );
}

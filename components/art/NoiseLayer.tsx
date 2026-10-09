type Kind = "grain" | "photocopy" | "crt";

const STYLE: Record<Kind, React.CSSProperties> = {
  grain: { backgroundImage: "url(/art/tiles/grain.png)", opacity: 0.18, mixBlendMode: "multiply" },
  photocopy: { backgroundImage: "url(/art/tiles/photocopy.png)", opacity: 0.35, mixBlendMode: "multiply" },
  crt: { backgroundImage: "repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 3px)", opacity: 0.06 },
};

/** Paper grain, photocopy toner noise or CRT scanlines over its positioned parent. One tiny tile; decorative. */
export function NoiseLayer({ kind, className = "" }: { kind: Kind; className?: string }) {
  return <div aria-hidden="true" data-noise={kind} className={`neon-noise pointer-events-none absolute inset-0 ${className}`} style={STYLE[kind]} />;
}

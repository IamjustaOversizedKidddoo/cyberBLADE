type BandTone = "paper" | "void" | "cyan";

// Colours come from the band tokens in globals.css (they also handle high contrast).
const TONES: Record<BandTone, string> = { paper: "band-paper", void: "band-void", cyan: "band-cyan" };

type Props = {
  tone: BandTone;
  /** Id of the heading that names this section. */
  labelledBy?: string;
  /** Full-bleed textures/art painted behind the composition (HalftoneField, NoiseLayer…). */
  backdrop?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * A full-bleed poster band. Its children are zones on a grid that may overlap; type, art and labels
 * stack in a fixed order (art under type, labels on top). The band clips anything that bleeds past
 * its edges, so oversized type never causes sideways page scroll.
 */
export function PosterSection({ tone, labelledBy, backdrop, className = "", children }: Props) {
  return (
    <section aria-labelledby={labelledBy} data-band={tone} className={`relative overflow-clip ${TONES[tone]} ${className}`}>
      {backdrop}
      <div className="poster-grid relative">{children}</div>
    </section>
  );
}

type ZoneProps = { className?: string; children: React.ReactNode };

/** Zones place content on the poster grid; give each a grid-area/col/row class for desktop and mobile. */
PosterSection.Art = function Art({ className = "", children }: ZoneProps) {
  return <div className={`relative z-[var(--z-art)] ${className}`}>{children}</div>;
};
PosterSection.Type = function Type({ className = "", children }: ZoneProps) {
  return <div className={`relative z-[var(--z-type)] ${className}`}>{children}</div>;
};
PosterSection.Caption = function Caption({ className = "", children }: ZoneProps) {
  return <div className={`relative z-[var(--z-type)] max-w-[60ch] ${className}`}>{children}</div>;
};
PosterSection.Labels = function Labels({ className = "", children }: ZoneProps) {
  return <div className={`relative z-[var(--z-ui)] flex flex-wrap gap-x-6 gap-y-1 ${className}`}>{children}</div>;
};

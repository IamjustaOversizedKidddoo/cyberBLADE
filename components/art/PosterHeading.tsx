import { Fragment } from "react";

type Size = "hero" | "section" | "label";

const SIZES: Record<Size, string> = {
  hero: "text-[clamp(4rem,17vw,15rem)] leading-[0.82]",
  section: "text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.88]",
  label: "text-[clamp(1.25rem,3vw,2rem)] leading-none",
};

type Props = {
  as?: "h1" | "h2" | "h3" | "p";
  lines: string[];
  size: Size;
  /** Let the type run past the band's left or right edge (the band clips it). */
  bleed?: "left" | "right";
  vertical?: boolean;
  /** RGB-split glitch on first paint and hover. Use rarely. */
  glitch?: boolean;
  id?: string;
  className?: string;
};

function Lines({ lines }: { lines: string[] }) {
  // The space between lines sits outside the block spans, so the heading's accessible name is a sentence.
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="block whitespace-nowrap">{line}</span>
    </Fragment>
  ));
}

/**
 * Huge Hacked display type used as part of the artwork. One semantic heading; the glitch copies are
 * aria-hidden, so the accessible name is just the words.
 */
export function PosterHeading({ as: Tag = "h2", lines, size, bleed, vertical, glitch = false, id, className = "" }: Props) {
  const bleedClass = bleed === "left" ? "-ml-[0.06em]" : bleed === "right" ? "-mr-[0.06em] text-right" : "";
  return (
    <Tag
      id={id}
      className={`font-display uppercase ${SIZES[size]} ${bleedClass} ${vertical ? "[writing-mode:vertical-rl]" : ""} ${glitch ? "neon-glitch" : "relative"} ${className}`}
      data-glitch={glitch ? "intro" : undefined}
    >
      <Lines lines={lines} />
      {glitch && (
        <>
          <span aria-hidden="true" className="neon-glitch-copy neon-glitch-cyan">
            <Lines lines={lines} />
          </span>
          <span aria-hidden="true" className="neon-glitch-copy neon-glitch-pink">
            <Lines lines={lines} />
          </span>
        </>
      )}
    </Tag>
  );
}

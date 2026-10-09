import { Fragment } from "react";
import { BlinkCursor } from "@/components/theme/BlinkCursor";

type Size = "hero" | "wordmark" | "section" | "label";

const SIZES: Record<Size, string> = {
  hero: "text-[length:var(--poster-hero)] leading-[0.82]",
  wordmark: "text-[length:var(--poster-wordmark)] leading-[0.85]",
  section: "text-[length:var(--poster-section)] leading-[0.88]",
  label: "text-[length:var(--poster-label)] leading-none",
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
  /** Split into one span per character (kinetic typography inside a ScrollScene). */
  split?: "chars";
  /** A blinking underscore after the last line — visual only, not part of the heading's name. */
  cursor?: boolean;
  id?: string;
  className?: string;
};

function Chars({ text }: { text: string }) {
  // Spaces stay plain text so the heading's accessible name keeps its words.
  return [...text].map((c, i) =>
    c === " " ? (
      " "
    ) : (
      <span key={i} data-char={i} className="inline-block">
        {c}
      </span>
    ),
  );
}

function Lines({ lines, cursor = false, split }: { lines: string[]; cursor?: boolean; split?: "chars" }) {
  // The space between lines sits outside the block spans, so the heading's accessible name is a sentence.
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="block whitespace-nowrap">
        {split ? (
          // Browsers read separate letter boxes one letter at a time, so the word is given once as
          // screen-reader text and the animated letters are hidden from assistive technology.
          <>
            <span className="sr-only">{line}</span>
            <span aria-hidden="true">
              <Chars text={line} />
            </span>
          </>
        ) : (
          line
        )}
        {cursor && i === lines.length - 1 && <BlinkCursor />}
      </span>
    </Fragment>
  ));
}

/**
 * Huge Hacked display type used as part of the artwork. One semantic heading; the glitch copies are
 * aria-hidden, so the accessible name is just the words.
 */
export function PosterHeading({ as: Tag = "h2", lines, size, bleed, vertical, glitch = false, cursor = false, split, id, className = "" }: Props) {
  const bleedClass = bleed === "left" ? "-ml-[0.06em]" : bleed === "right" ? "-mr-[0.06em] text-right" : "";
  return (
    <Tag
      id={id}
      className={`font-display uppercase ${SIZES[size]} ${bleedClass} ${vertical ? "[writing-mode:vertical-rl]" : ""} ${glitch ? "neon-glitch" : "relative"} ${className}`}
      data-glitch={glitch ? "intro" : undefined}
    >
      <Lines lines={lines} cursor={cursor} split={split} />
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

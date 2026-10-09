import { toneVar, type Tone } from "./tone";

type Fade = "left" | "right" | "top" | "bottom" | "radial";

const FADES: Record<Fade, string> = {
  left: "linear-gradient(to right, #000, transparent 85%)",
  right: "linear-gradient(to left, #000, transparent 85%)",
  top: "linear-gradient(to bottom, #000, transparent 85%)",
  bottom: "linear-gradient(to top, #000, transparent 85%)",
  radial: "radial-gradient(circle at 70% 40%, #000, transparent 70%)",
};

type Props = { tone: Tone; density?: number; angle?: number; fade?: Fade; className?: string };

/**
 * A printed dot screen (newspaper/comic halftone) in one palette colour, filling its positioned parent.
 * Pure CSS: one radial-gradient, optionally faded by a mask. Decorative.
 */
export function HalftoneField({ tone, density = 6, angle = 45, fade, className = "" }: Props) {
  const dot = Math.max(0.6, density / 5);
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={fade ? { maskImage: FADES[fade], WebkitMaskImage: FADES[fade] } : undefined}>
      <div
        className="absolute -inset-1/4"
        style={{
          backgroundImage: `radial-gradient(${toneVar(tone)} ${dot}px, transparent ${dot + 0.6}px)`,
          backgroundSize: `${density}px ${density}px`,
          transform: `rotate(${angle}deg)`,
        }}
      />
    </div>
  );
}

import { toneVar, type Tone } from "./tone";

// Torn-paper edges drawn by hand in a 100×10 box; the filled side is the colour of the next band.
const PATHS = [
  "M0 10 L0 4 L4 5.2 L7 3.1 L11 4.6 L15 2.4 L19 4.9 L24 3.3 L28 5.8 L33 2.9 L37 4.4 L42 1.8 L46 4.1 L51 3 L55 5.5 L60 2.6 L64 4.8 L69 3.4 L73 6 L78 2.2 L82 4.5 L87 3.1 L91 5.2 L96 2.8 L100 4.3 L100 10 Z",
  "M0 10 L0 6 L3 3.5 L8 5 L10 2 L16 4.2 L18 6.1 L25 2.9 L29 3.8 L31 1.5 L38 5.4 L44 3.2 L47 6.4 L53 2.1 L58 3.9 L62 1.9 L67 5.6 L71 3.7 L76 4.9 L80 1.6 L86 5.1 L90 2.7 L95 4 L100 2.5 L100 10 Z",
  "M0 10 L0 3 L6 4.5 L9 2.6 L14 6.2 L20 3.1 L23 4.7 L27 2 L34 4.3 L39 3 L43 5.9 L49 2.4 L52 3.6 L57 1.7 L63 4.6 L66 3.3 L72 6.3 L77 2.8 L81 3.9 L88 1.9 L92 4.4 L97 3.2 L100 5 L100 10 Z",
];

type Props = { edge: "top" | "bottom"; variant?: 1 | 2 | 3; tone: Tone; className?: string };

/** A rough, torn ink edge between two bands. `tone` is the colour of the band it tears into. Decorative. */
export function InkEdge({ edge, variant = 1, tone, className = "" }: Props) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className={`pointer-events-none block h-6 w-full sm:h-10 ${edge === "top" ? "rotate-180" : ""} ${className}`}
      style={{ color: toneVar(tone) }}
    >
      <path d={PATHS[variant - 1]} fill="currentColor" />
    </svg>
  );
}

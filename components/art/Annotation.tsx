import { toneVar, type Tone } from "./tone";

type Props = {
  /** Where the label sits, in % of the parent art box. */
  from: [number, number];
  /** What it points at, in % of the parent art box. */
  to: [number, number];
  label: string;
  tone?: Tone;
  /** A slightly bowed, hand-drawn leader line instead of a straight one. */
  hand?: boolean;
  className?: string;
};

/**
 * A field-manual callout: a label with a leader line pointing at part of an artwork or diagram.
 * The label is real text; the line is decorative. Place inside a `relative` art box.
 */
export function Annotation({ from, to, label, tone = "current", hand = true, className = "" }: Props) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const d = hand ? `M ${x1} ${y1} Q ${(x1 + x2) / 2 + 3} ${(y1 + y2) / 2 - 4} ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" style={{ color: toneVar(tone) }}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        <circle cx={x2} cy={y2} r="0.9" fill="currentColor" />
      </svg>
      <span
        className={`absolute -translate-y-full whitespace-nowrap bg-[var(--band-bg,transparent)] px-1 font-ui text-xs tracking-wider sm:text-sm ${className}`}
        style={{ left: `${x1}%`, top: `${y1}%`, color: toneVar(tone) }}
      >
        {label}
      </span>
    </>
  );
}

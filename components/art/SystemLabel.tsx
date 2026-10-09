import { toneVar, type Tone } from "./tone";

/** Pixel micro-type for machine metadata: IDs, coordinates, status. Real text, read in order. */
export function SystemLabel({ children, tone = "current", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`font-ui text-xs tracking-wider sm:text-sm ${className}`} style={{ color: toneVar(tone) }}>
      {children}
    </span>
  );
}

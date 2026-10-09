import { Counter } from "./motion/Counter";

type Stage = { value: number; label: string };

/**
 * Triage as numbers that shrink: each row narrower than the one above, each count running up when it
 * comes into view (Counter keeps the final value in the markup). Values are an illustrative example.
 */
export function TriageFunnel({ stages, caption, className = "" }: { stages: readonly Stage[]; caption: string; className?: string }) {
  return (
    <figure className={className}>
      <ol className="space-y-2">
        {stages.map((s, i) => {
          const last = i === stages.length - 1;
          return (
            <li
              key={s.label}
              data-from={JSON.stringify({ x: -60, opacity: 0 })}
              data-at={String(0.3 + i * 0.1)}
              data-dur="0.15"
              className={`flex items-baseline justify-between gap-4 border-l-4 px-4 py-2 ${last ? "border-pink bg-pink/10" : "border-cyan bg-cyan/5"}`}
              style={{ width: `${100 - i * 12}%` }}
            >
              <Counter to={s.value} grouped className={`font-display text-3xl tabular-nums sm:text-5xl ${last ? "text-pink" : ""}`} />
              <span className="text-right font-ui text-sm tracking-wider text-muted sm:text-base">{s.label}</span>
            </li>
          );
        })}
      </ol>
      <figcaption className="mt-3 font-ui text-xs tracking-wider text-muted">{caption}</figcaption>
    </figure>
  );
}

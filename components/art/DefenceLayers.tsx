import { BladeMark } from "./BladeMark";

type Layer = { name: string; control: string };

const STEP = 9; // % inset per layer

/**
 * Defence in depth as one object: nested frames from the outer edge to the data at the centre, each
 * labelled with the control that guards it. Scenes land the frames from the outside in (`data-from`).
 * Screen readers get the ordered list; the drawing itself is decorative.
 */
export function DefenceLayers({ layers, className = "" }: { layers: readonly Layer[]; className?: string }) {
  return (
    <figure className={className}>
      <div aria-hidden="true" className="relative aspect-square w-full">
        {layers.map((l, i) => {
          const inner = i === layers.length - 1;
          return (
            <div
              key={l.name}
              data-from={JSON.stringify({ scale: 1.35, opacity: 0 })}
              data-at={String(0.12 + i * 0.1)}
              data-dur="0.2"
              className={`absolute border-2 border-current ${inner ? "bg-cyan text-void" : ""}`}
              style={{ inset: `${i * STEP}%` }}
            >
              <span className="absolute inset-x-2 top-1 font-ui text-xs leading-tight tracking-wider sm:inset-x-3 sm:top-2 sm:text-sm">
                {String(i + 1).padStart(2, "0")} {l.name}
                <span className="hidden text-xs opacity-75 md:block">{l.control}</span>
              </span>
              {inner && <BladeMark className="absolute inset-[22%] h-auto w-auto" />}
            </div>
          );
        })}
      </div>
      <ol aria-label="Defence in depth, outermost layer first" className="sr-only">
        {layers.map((l) => (
          <li key={l.name}>
            {l.name}: {l.control}
          </li>
        ))}
      </ol>
    </figure>
  );
}

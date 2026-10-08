import { InkEdge } from "./InkEdge";

type Kind = "schematic" | "ascii" | "ink";

/** An editorial break between sections: a circuit trace, an ASCII rule, or a brushed ink line. Decorative. */
export function VisualDivider({ kind, className = "" }: { kind: Kind; className?: string }) {
  if (kind === "ink") {
    return (
      <div aria-hidden="true" className={className}>
        <InkEdge edge="bottom" variant={2} tone="ink" className="!h-3" />
      </div>
    );
  }
  if (kind === "ascii") {
    return (
      <div aria-hidden="true" className={`overflow-hidden whitespace-nowrap font-mono text-xs text-muted ${className}`}>
        {"+--[ 0x00 ]" + "-".repeat(40) + "[ SEC ]" + "-".repeat(80) + "+"}
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={className}>
      <svg viewBox="0 0 400 12" preserveAspectRatio="none" className="block h-3 w-full text-cyan">
        <path d="M0 6 H120 L128 1 H180 L188 6 H400" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {[60, 154, 260, 340].map((x) => (
          <rect key={x} x={x - 2} y={4} width={4} height={4} fill="currentColor" />
        ))}
      </svg>
    </div>
  );
}

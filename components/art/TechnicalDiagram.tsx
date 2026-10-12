import { linkPath, type DiagramLink, type DiagramNode } from "@/lib/art/diagram";
import { toneVar, type Tone } from "./tone";

type Props = {
  /** Accessible name of the diagram ("How a lesson works", "Attack path"…). */
  title: string;
  nodes: DiagramNode[];
  links: DiagramLink[];
  /** Node to highlight; inside a ScrollScene the highlighted node follows data-step instead. */
  active?: string;
  style?: "schematic" | "hand";
  /** A separate layout for phones (e.g. stackVertically(nodes)); same node ids. */
  mobileNodes?: DiagramNode[];
  tone?: Tone;
  /** Box shape (width/height) of the drawing area. */
  ratio?: string;
  /** Show each node's label next to it (off for small glyphs). */
  labels?: boolean;
  /** Prefix labels with their step number (only for diagrams that really are a sequence). */
  numbered?: boolean;
  className?: string;
};

function Drawing({ nodes, links, active, style, tone, ratio, labels, numbered, className }: Omit<Props, "title" | "mobileNodes"> & { tone: Tone }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <div aria-hidden="true" className={`diagram relative ${className}`} style={{ aspectRatio: ratio, color: toneVar(tone) }} data-style={style}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {links.map((l) => {
          const a = byId.get(l.from);
          const b = byId.get(l.to);
          if (!a || !b) return null;
          return (
            <path
              key={`${l.from}-${l.to}`}
              data-link-from={l.from}
              data-link-to={l.to}
              data-shape={l.shape ?? "straight"}
              className="diagram-link"
              d={linkPath(a, b, l.shape)}
              pathLength={100}
              fill="none"
              stroke="currentColor"
              strokeWidth={style === "hand" ? 2.25 : 1.25}
              strokeDasharray={l.dashed ? "2 2" : undefined}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {nodes.map((n, i) => (
        <span
          key={n.id}
          data-index={i}
          data-active={active === n.id ? "" : undefined}
          data-node-id={n.id}
          data-morph={n.morph ? JSON.stringify(n.morph) : undefined}
          className="diagram-node absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          <span className={`block border-2 border-current bg-[var(--band-bg,transparent)] ${style === "hand" ? "h-5 w-5" : "h-3 w-3"} ${n.kind === "cloud" || n.kind === "signal" ? "rounded-full" : ""}`} />
          {labels && (
            <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap bg-[var(--band-bg,transparent)] px-1 font-ui text-xs tracking-wider sm:text-base text-[var(--band-fg,inherit)]">
              {numbered && <span className="mr-2 font-mono text-[var(--band-fg,inherit)] font-semibold">{String(i + 1).padStart(2, "0")}</span>}
              {n.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * CYBERBLADE's schematic language: nodes, links and labels drawn from data (lib/art/diagram.ts).
 * Screen readers get the title and an ordered list of the node labels; the drawing itself is hidden.
 */
export function TechnicalDiagram({ title, nodes, links, active, style = "schematic", mobileNodes, tone = "current", ratio = "16 / 10", labels = true, numbered = false, className = "" }: Props) {
  const drawing = { links, active, style, tone, ratio, labels, numbered };
  return (
    <figure className={className}>
      <span role="img" aria-label={title} className="block">
        {mobileNodes ? (
          <>
            <Drawing {...drawing} nodes={nodes} className="hidden md:block" />
            <Drawing {...drawing} nodes={mobileNodes} ratio="3 / 4" className="md:hidden" />
          </>
        ) : (
          <Drawing {...drawing} nodes={nodes} />
        )}
      </span>
      <ol className="sr-only">
        {nodes.map((n) => (
          <li key={n.id}>{n.label}</li>
        ))}
      </ol>
    </figure>
  );
}

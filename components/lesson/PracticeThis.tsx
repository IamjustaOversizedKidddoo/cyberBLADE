import Link from "next/link";
import type { PracticeCard } from "@/lib/content/practice";

const KIND_LABEL: Record<string, string> = {
  family: "Scenario",
  shift: "Full shift",
  tool: "Tool",
  report: "Report",
  lesson: "Lesson",
};

export function PracticeThis({ cards }: { cards: PracticeCard[] }) {
  if (cards.length === 0) return null;
  return (
    <ul className="not-prose my-6 grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <li key={c.target}>
          <Link
            href={c.href}
            className="group flex h-full min-h-[44px] flex-col gap-1 rounded-sm border border-line bg-surface p-4 transition-colors duration-150 hover:border-cyan/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan">{KIND_LABEL[c.kind] ?? c.kind}</span>
            <span className="font-sans text-[15px] font-semibold text-ink group-hover:text-cyan">{c.title}</span>
            <span className="font-sans text-[13px] leading-snug text-muted">{c.instruction}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import type { Lesson } from "@/lib/content/schema";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";

type Props = { lessons: Pick<Lesson, "id" | "title">[]; currentId: string };

export function LessonNav({ lessons, currentId }: Props) {
  const i = lessons.findIndex((l) => l.id === currentId);
  const prev = i > 0 ? lessons[i - 1] : null;
  const next = i >= 0 && i < lessons.length - 1 ? lessons[i + 1] : null;

  return (
    <nav
      aria-label="Lesson navigation"
      className="rounded-sm border border-line bg-surface p-5 mt-14"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Previous */}
        <div className="w-full sm:w-auto">
          {prev ? (
            <Link
              href={`/learn/${prev.id}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xs border border-line bg-surface-raised px-4 py-2 font-ui text-xs text-muted hover:text-cyan hover:border-cyan/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan max-w-xs truncate"
            >
              <IconChevronLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">← {prev.title}</span>
            </Link>
          ) : (
            <span className="text-muted font-ui text-xs">First lesson in module</span>
          )}
        </div>

        {/* Center: Module index & Rank map */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[11px] text-muted">
            ORDER {i + 1} / {lessons.length}
          </span>
          <Link
            href="/learn/core"
            className="font-ui text-xs text-cyan hover:underline tracking-wider uppercase font-semibold"
          >
            [RANK ROADMAP]
          </Link>
        </div>

        {/* Next */}
        <div className="w-full sm:w-auto text-right">
          {next ? (
            <Link
              href={`/learn/${next.id}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xs border border-cyan/50 bg-cyan/10 px-4 py-2 font-ui text-xs font-semibold text-cyan hover:bg-cyan hover:text-void transition-all shadow-[0_0_10px_rgba(15,190,255,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan max-w-xs truncate"
            >
              <span className="truncate">{next.title} →</span>
              <IconChevronRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ) : (
            <span className="text-muted font-ui text-xs">Module complete</span>
          )}
        </div>
      </div>
    </nav>
  );
}

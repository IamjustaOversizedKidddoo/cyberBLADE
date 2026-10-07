import Link from "next/link";
import type { Lesson } from "@/lib/content/schema";

type Props = { lessons: Pick<Lesson, "id" | "title">[]; currentId: string };

export function LessonNav({ lessons, currentId }: Props) {
  const i = lessons.findIndex((l) => l.id === currentId);
  const prev = i > 0 ? lessons[i - 1] : null;
  const next = i >= 0 && i < lessons.length - 1 ? lessons[i + 1] : null;
  return (
    <nav aria-label="Lesson navigation" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      {prev ? (
        <Link href={`/learn/${prev.id}`} className="neon-toggle">
          ← {prev.title}
        </Link>
      ) : (
        <span />
      )}
      <Link href="/learn/core" className="neon-toggle">
        rank_map
      </Link>
      {next ? (
        <Link href={`/learn/${next.id}`} className="neon-toggle">
          {next.title} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

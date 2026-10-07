const RANK_MAP = { href: "/learn/core", label: "Back to the rank map →" };

/** Where to send a learner who just finished a lesson's lab. */
export function continueTarget(
  lessons: { id: string; title: string }[],
  currentId: string | undefined,
): { href: string; label: string } {
  const i = lessons.findIndex((l) => l.id === currentId);
  const next = i >= 0 ? lessons[i + 1] : undefined;
  return next ? { href: `/learn/${next.id}`, label: `Continue to next lesson: ${next.title} →` } : RANK_MAP;
}

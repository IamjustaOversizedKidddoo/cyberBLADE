"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { QueueCard } from "@/lib/review/session";
import type { RatingOption } from "@/lib/review/scheduler";
import { submitCardReviewAction } from "@/app/(app)/review/actions";
import { IconCheck, IconPlay } from "@/components/ui/icons";

type Props = {
  initialQueue: QueueCard[];
};

export function DailyReviewSession({ initialQueue }: Props) {
  const [queue, setQueue] = useState<QueueCard[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [actionAnnouncement, setActionAnnouncement] = useState("");

  const currentItem = queue[currentIndex];
  const isFinished = currentIndex >= queue.length;

  const liveAnnouncement = actionAnnouncement || (
    currentItem
      ? `Card ${currentIndex + 1} of ${queue.length}: ${currentItem.card.front}`
      : isFinished
        ? "Spaced review session complete. All cards reviewed."
        : ""
  );

  // Keyboard shortcut handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (pending || isFinished) return;

      // Ignore when typing inside input / textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setRevealed(true);
          setActionAnnouncement(`Answer revealed: ${currentItem?.card.back}`);
        }
      } else {
        if (e.key === "1") {
          e.preventDefault();
          void submitRating("again");
        } else if (e.key === "2") {
          e.preventDefault();
          void submitRating("hard");
        } else if (e.key === "3") {
          e.preventDefault();
          void submitRating("good");
        } else if (e.key === "4") {
          e.preventDefault();
          void submitRating("easy");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealed, pending, isFinished, currentItem]);

  async function submitRating(rating: RatingOption) {
    if (!currentItem || pending) return;
    setPending(true);

    try {
      const res = await submitCardReviewAction(currentItem.card.id, rating);
      setTotalXpEarned((prev) => prev + res.xpAwarded);
      setCompletedCount((prev) => prev + 1);

      // Advance to next card
      setRevealed(false);
      setCurrentIndex((prev) => prev + 1);
    } catch {
      setActionAnnouncement("Error saving review. Please try clicking the button again.");
    } finally {
      setPending(false);
    }
  }

  if (isFinished || queue.length === 0) {
    return (
      <section
        aria-labelledby="review-complete-heading"
        className="rounded-sm border-2 border-cyan/60 bg-console p-8 text-center space-y-6 shadow-[0_0_30px_rgba(15,190,255,0.15)]"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan/15 text-cyan border border-cyan/40">
          <IconCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 id="review-complete-heading" className="font-ui text-xl font-bold tracking-wider text-ink uppercase">
            DAILY RETRIEVAL DRILL COMPLETE
          </h2>
          <p className="font-sans text-sm text-secondary max-w-md mx-auto">
            {completedCount > 0
              ? `You reviewed ${completedCount} retrieval target${completedCount === 1 ? "" : "s"} and earned ${totalXpEarned} XP. Spaced repetition intervals have been recalibrated.`
              : "All cards are currently up to date. Return tomorrow or as your next review intervals mature."}
          </p>
        </div>

        <div className="pt-2 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xs border-2 border-cyan bg-cyan px-6 py-2.5 font-ui text-sm font-bold tracking-wider text-void shadow-[0_0_15px_rgba(15,190,255,0.4)] hover:bg-cyan/90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            <span>RETURN TO DASHBOARD</span>
          </Link>
          <Link
            href="/learn/core"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xs border border-line bg-surface-raised px-6 py-2.5 font-ui text-sm font-semibold tracking-wider text-ink hover:border-cyan/60 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            <span>CONTINUE MISSIONS</span>
          </Link>
        </div>
      </section>
    );
  }

  const { card, isNew } = currentItem;

  return (
    <div className="space-y-6">
      {/* Screen Reader ARIA Live Region */}
      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Progress & Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="font-ui text-xs font-bold tracking-wider uppercase text-cyan">
            RETRIEVAL TARGET {currentIndex + 1} OF {queue.length}
          </span>
          {isNew && (
            <span className="rounded-xs border border-purple/50 bg-purple/15 px-2 py-0.5 font-ui text-[10px] font-bold uppercase tracking-wider text-purple">
              NEW CARD
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase text-muted">
            CAT: {card.category}
          </span>
          <span className="font-ui text-xs text-muted">·</span>
          <span className="font-mono text-xs uppercase text-cyan">
            RANK_{card.rank}
          </span>
        </div>
      </div>

      {/* Flashcard Box */}
      <article
        aria-label={`Flashcard: ${card.front}`}
        className="rounded-sm border-2 border-line bg-surface p-6 sm:p-8 space-y-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all"
      >
        <div className="space-y-2">
          <span className="font-ui text-xs font-bold tracking-widest text-cyan uppercase block">
            RETRIEVAL PROMPT
          </span>
          <h2 className="text-ink font-sans text-lg sm:text-xl font-semibold leading-relaxed">
            {card.front}
          </h2>
        </div>

        {/* Reveal Toggle */}
        {!revealed ? (
          <div className="pt-4 border-t border-line/60">
            <button
              type="button"
              onClick={() => {
                setRevealed(true);
                setActionAnnouncement(`Answer revealed: ${card.back}`);
              }}
              className="w-full min-h-[48px] rounded-xs border-2 border-cyan/70 bg-cyan/10 p-3 font-ui text-sm font-bold tracking-wider text-cyan hover:bg-cyan hover:text-void transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              REVEAL TARGET ANSWER <span className="opacity-70 font-normal">[SPACE / ENTER]</span>
            </button>
          </div>
        ) : (
          <div className="pt-6 border-t border-line/60 space-y-6 animate-in fade-in duration-200">
            <div className="space-y-2">
              <span className="font-ui text-xs font-bold tracking-widest text-purple uppercase block">
                TARGET SYNTHESIS // CORRECT RECALL
              </span>
              <p className="text-ink font-sans text-base leading-relaxed">
                {card.back}
              </p>
              {card.commandSnippet && (
                <div className="mt-3 rounded-xs border border-line bg-console p-3 font-mono text-xs text-cyan">
                  <code>{card.commandSnippet}</code>
                </div>
              )}
            </div>

            {/* Formative Evaluation Ratings */}
            <div className="space-y-3 pt-4 border-t border-line/40">
              <span className="font-ui text-xs font-semibold tracking-wider text-secondary uppercase block">
                HOW ACCURATELY DID YOU RECALL THIS TARGET?
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void submitRating("again")}
                  className="min-h-[44px] rounded-xs border border-pink/60 bg-pink/10 px-3 py-2 text-center font-ui text-xs font-bold tracking-wider text-pink hover:bg-pink hover:text-void transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink"
                >
                  <span className="block">[1] AGAIN</span>
                  <span className="font-mono text-[10px] opacity-80 font-normal">Reset 1d</span>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void submitRating("hard")}
                  className="min-h-[44px] rounded-xs border border-amber-400/60 bg-amber-400/10 px-3 py-2 text-center font-ui text-xs font-bold tracking-wider text-amber-400 hover:bg-amber-400 hover:text-void transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <span className="block">[2] HARD</span>
                  <span className="font-mono text-[10px] opacity-80 font-normal">Difficult</span>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void submitRating("good")}
                  className="min-h-[44px] rounded-xs border border-cyan/60 bg-cyan/15 px-3 py-2 text-center font-ui text-xs font-bold tracking-wider text-cyan hover:bg-cyan hover:text-void transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                >
                  <span className="block">[3] GOOD</span>
                  <span className="font-mono text-[10px] opacity-80 font-normal">Standard</span>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void submitRating("easy")}
                  className="min-h-[44px] rounded-xs border border-emerald-400/60 bg-emerald-400/10 px-3 py-2 text-center font-ui text-xs font-bold tracking-wider text-emerald-400 hover:bg-emerald-400 hover:text-void transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <span className="block">[4] EASY</span>
                  <span className="font-mono text-[10px] opacity-80 font-normal">Instant</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

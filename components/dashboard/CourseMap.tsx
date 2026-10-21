import Link from "next/link";
import { CORE, TRACKS, type TrackGroup } from "@/lib/catalog/tracks";
import { SystemLabel } from "@/components/art/SystemLabel";
import { HalftoneField } from "@/components/art/HalftoneField";
import { IconLock } from "@/components/ui/icons";

const SOON_GROUPS: TrackGroup[] = ["Defend", "Attack", "Build", "Emerging", "Governance", "Leadership"];

const RANK_SUMMARY: Record<number, string> = {
  0: "How computers, files and the internet work. Your first terminal.",
  1: "Networking, Linux, Windows and PowerShell.",
  2: "Web architecture, the security core and your first tools.",
};

const RANK_CODENAME: Record<number, string> = {
  0: "INITIATE",
  1: "OPERATOR",
  2: "WATCHER",
};

const GROUP_SIGIL: Record<TrackGroup, string> = {
  Flagship: "★",
  Defend: "■",
  Attack: "▲",
  Build: "◆",
  Emerging: "●",
  Governance: "▬",
  Leadership: "╬",
};

const TRACK_ROUTES: Record<string, string> = {
  soc: "/learn/soc-l1",
  pentest: "/learn/pentest-l1",
  purple: "/learn/core",
  cloud: "/learn/core",
};

type Props = { currentRank: number; xp: number; rankProgress: { done: number; total: number } };

export function CourseMap({ currentRank, xp, rankProgress }: Props) {
  const launch = TRACKS.filter((t) => t.status === "open");
  const soon = TRACKS.filter((t) => t.status === "coming_soon");

  return (
    <div className="space-y-16">
      {/* ── SHARED CORE ────────────────────────────────────────────────────── */}
      <section aria-labelledby="core-heading">
        {/* Section header */}
        <div className="flex items-center gap-4 border-b-2 border-line pb-4">
          <h2 id="core-heading" className="font-ui text-sm tracking-[0.25em] text-muted">
            CAMPAIGN // SHARED_CORE
          </h2>
          <div aria-hidden="true" className="flex-1 h-px bg-line" />
          <SystemLabel className="text-cyan">
            ALL RANKS UNLOCKED
          </SystemLabel>
        </div>

        {/* Rank nodes in double-bezel tactical chassis */}
        <ol className="mt-6 space-y-3" aria-label="Shared core ranks">
          {CORE.ranks.map((r) => {
            const isCurrent = r.rank === currentRank;
            const isCleared = r.rank < currentRank;

            return (
              <li
                key={r.rank}
                data-rank-node={r.rank}
                className={`p-1 rounded-sm border ${
                  isCurrent
                    ? "border-cyan/50 bg-surface/70 shadow-[0_0_20px_rgba(15,190,255,0.08)]"
                    : isCleared
                    ? "border-purple/30 bg-surface/40"
                    : "border-cyan/30 bg-surface/30"
                }`}
              >
                <div
                  className={`grid grid-cols-1 sm:grid-cols-[4rem_1fr_auto] gap-px rounded-xs border ${
                    isCurrent ? "border-cyan/30 bg-console" : isCleared ? "border-purple/20 bg-console" : "border-line/40 bg-console/60"
                  }`}
                >
                  {/* Giant rank numeral cell */}
                  <div
                    className={`flex items-center justify-center bg-void py-6 font-display text-5xl leading-none ${
                      isCurrent ? "text-cyan" : isCleared ? "text-purple" : "text-cyan/80"
                    }`}
                    aria-hidden="true"
                  >
                    {String(r.rank).padStart(2, "0")}
                  </div>

                  {/* Main content */}
                  <div className="bg-void px-5 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <SystemLabel
                        className={isCurrent ? "text-cyan" : isCleared ? "text-purple" : "text-cyan/70"}
                      >
                        {RANK_CODENAME[r.rank] ?? `RANK_${r.rank}`}
                      </SystemLabel>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-0.5 font-ui text-xs tracking-wider uppercase font-semibold ${
                          isCurrent
                            ? "border-cyan/50 bg-cyan/10 text-cyan shadow-[0_0_10px_rgba(15,190,255,0.2)]"
                            : isCleared
                            ? "border-purple/50 bg-purple/10 text-purple"
                            : "border-cyan/40 bg-cyan/5 text-cyan"
                        }`}
                      >
                        {isCleared ? "CLEARED" : isCurrent ? "ACTIVE" : "UNLOCKED"}
                      </span>
                    </div>
                    <h3 className="mt-2 font-ui text-lg text-ink">
                      rank_{r.rank} · {r.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{RANK_SUMMARY[r.rank]}</p>
                  </div>

                  {/* Action cell */}
                  <div className="flex items-center bg-void px-5 py-3 sm:py-0">
                    {isCurrent ? (
                      <Link
                        href={`/learn/core#rank-${r.rank}`}
                        aria-label={rankProgress.done > 0 ? "Continue" : `Begin rank_${r.rank}`}
                        className="btn-glitch inline-flex min-h-[44px] items-center justify-center border-2 border-cyan px-5 py-2 font-ui text-sm text-cyan hover:bg-cyan hover:text-void"
                      >
                        {rankProgress.done > 0 ? "CONTINUE →" : "BEGIN →"}
                      </Link>
                    ) : isCleared ? (
                      <Link
                        href={`/learn/core#rank-${r.rank}`}
                        className="inline-flex min-h-[44px] items-center justify-center border border-purple px-4 py-2 font-ui text-xs text-purple hover:bg-purple hover:text-void transition-colors"
                      >
                        REVIEW →
                      </Link>
                    ) : (
                      <Link
                        href={`/learn/core#rank-${r.rank}`}
                        className="btn-glitch inline-flex min-h-[44px] items-center justify-center border border-cyan/60 bg-cyan/10 px-5 py-2 font-ui text-sm font-semibold text-cyan hover:bg-cyan hover:text-void transition-colors"
                      >
                        OPEN RANK →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* XP tally */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <SystemLabel className="text-muted">XP TOTAL</SystemLabel>
            <span className="font-display text-3xl text-cyan leading-none">{xp.toLocaleString("en-US")}</span>
          </div>
          <div aria-hidden="true" className="hidden sm:block flex-1 h-px bg-line mx-2" />
          <SystemLabel className="text-secondary">
            {rankProgress.done}/{rankProgress.total} LESSONS COMPLETE
          </SystemLabel>
        </div>
      </section>

      {/* ── LAUNCH TRACKS ──────────────────────────────────────────────────── */}
      <section aria-labelledby="tracks-heading">
        <div className="flex items-center gap-4 border-b-2 border-line pb-4">
          <h2 id="tracks-heading" aria-label="job_tracks" className="font-ui text-sm tracking-[0.25em] text-cyan">
            JOB_TRACKS // OPEN &amp; READY TO EXPLORE
          </h2>
          <div aria-hidden="true" className="flex-1 h-px bg-line" />
          <SystemLabel className="text-cyan">{launch.length} READY</SystemLabel>
        </div>

        <ul className="mt-6 grid gap-px bg-line sm:grid-cols-2" aria-label="Open job tracks">
          {launch.map((t, i) => (
            <li
              key={t.id}
              className="relative overflow-hidden bg-void p-5 flex flex-col justify-between"
            >
              {i === 0 && (
                <div className="pointer-events-none absolute inset-0 opacity-10">
                  <HalftoneField tone="cyan" density={6} fade="radial" className="opacity-40" />
                </div>
              )}
              <div className="relative">
                <SystemLabel className="text-cyan">
                  {`TRACK ${String(i + 1).padStart(2, "0")} // ${t.group.toUpperCase()}`}
                </SystemLabel>
                <p className="mt-2 font-ui text-lg text-ink font-bold">{t.title}</p>
                <div className="mt-4 border-t border-line pt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-ui text-xs text-cyan font-semibold tracking-wider">● CLEARANCE ACTIVE</span>
                  <Link
                    href={TRACK_ROUTES[t.id] ?? "/learn/core"}
                    className="btn-glitch inline-flex min-h-[38px] items-center justify-center border-2 border-cyan bg-cyan/15 px-4 py-1.5 font-ui text-xs font-bold text-cyan hover:bg-cyan hover:text-void transition-colors cursor-pointer"
                  >
                    ENTER TRACK →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── CLASSIFIED / COMING SOON ───────────────────────────────────────── */}
      <section aria-labelledby="soon-heading">
        <div className="flex items-center gap-4 border-b-2 border-line pb-4">
          <h2 id="soon-heading" className="font-ui text-sm tracking-[0.25em] text-muted">
            CLASSIFIED // UPCOMING_TRACKS
          </h2>
          <div aria-hidden="true" className="flex-1 h-px bg-line" />
          <SystemLabel className="text-secondary">{soon.length} REDACTED</SystemLabel>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SOON_GROUPS.map((group) => {
            const groupTracks = soon.filter((t) => t.group === group);
            if (groupTracks.length === 0) return null;
            return (
              <div key={group} className="border border-line p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-display text-muted text-lg" aria-hidden="true">
                    {GROUP_SIGIL[group]}
                  </span>
                  <SystemLabel className="text-secondary">{group.toUpperCase()}</SystemLabel>
                </div>
                <ul className="space-y-1.5">
                  {groupTracks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span aria-hidden="true" className="font-ui text-xs text-muted">▒▒</span>
                      <span className="text-sm text-secondary">{t.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

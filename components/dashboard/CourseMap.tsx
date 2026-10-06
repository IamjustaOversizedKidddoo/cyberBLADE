import { CORE, TRACKS, type TrackGroup } from "@/lib/catalog/tracks";

const SOON_GROUPS: TrackGroup[] = ["Defend", "Attack", "Build", "Emerging", "Governance", "Leadership"];

const RANK_SUMMARY: Record<number, string> = {
  0: "How computers, files and the internet work. Your first terminal.",
  1: "Networking, Linux, Windows and PowerShell.",
  2: "Web architecture, the security core and your first tools.",
};

export function CourseMap({ currentRank }: { currentRank: number }) {
  const launch = TRACKS.filter((t) => t.status === "open");
  const soon = TRACKS.filter((t) => t.status === "coming_soon");

  return (
    <div className="space-y-12">
      <section aria-labelledby="core-heading">
        <h2 id="core-heading" className="mb-6 text-4xl">
          shared_core
        </h2>
        <ol className="space-y-3 border-l border-line pl-6">
          {CORE.ranks.map((r) => {
            const state = r.rank < currentRank ? "done" : r.rank === currentRank ? "current" : "locked";
            return (
              <li key={r.rank} className={`border p-4 ${state === "current" ? "border-cyan" : "border-line"}`}>
                <h3 className={`text-xl ${state === "current" ? "text-cyan" : state === "done" ? "text-ink" : "text-muted"}`}>
                  rank_{r.rank} · {r.name}
                  {state === "current" && <span className="ml-3 text-sm text-pink">Start here</span>}
                  {state === "done" && <span className="ml-3 text-sm text-purple">Complete</span>}
                  {state === "locked" && <span className="ml-3 text-sm">🔒︎ Locked</span>}
                </h3>
                <p className="mt-1 text-muted">{RANK_SUMMARY[r.rank]}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="mb-2 text-4xl">
          job_tracks
        </h2>
        <p className="mb-6 text-muted">Unlocks after the core. Pick the job you want.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {launch.map((t) => (
            <li key={t.id} className="border border-line p-4">
              <h3 className="text-lg text-ink">{t.title}</h3>
              <p className="text-sm text-muted">🔒︎ Unlocks after the core</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="soon-heading">
        <h2 id="soon-heading" className="mb-6 text-4xl">
          coming_soon
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SOON_GROUPS.map((group) => (
            <div key={group}>
              <h3 className="mb-2 text-muted">{group}</h3>
              <ul className="space-y-1 text-sm text-muted">
                {soon
                  .filter((t) => t.group === group)
                  .map((t) => (
                    <li key={t.id}>🔒︎ {t.title}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

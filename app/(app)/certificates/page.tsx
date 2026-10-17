import type { Metadata } from "next";
import Link from "next/link";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { listLearnerTrackEligibilities } from "@/lib/certificates/eligibility";
import { CertificateView } from "@/components/certificates/CertificateView";
import { ClaimCertificateModal } from "@/components/certificates/ClaimCertificateModal";

export const metadata: Metadata = {
  title: "My Certificates | CyberBLADE",
  description: "Official verified certificates of completion earned across CyberBLADE technical tracks.",
};

export default async function CertificatesPage() {
  const operator = await requireOperator();
  const ctx = getCtx();

  const eligibilities = await listLearnerTrackEligibilities(ctx, operator.id);
  const issuedList = eligibilities.filter((e) => e.issuedCertificate !== null);
  const unclaimedEligible = eligibilities.filter((e) => e.eligible && !e.issuedCertificate);
  const lockedTracks = eligibilities.filter((e) => !e.eligible);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="border-b border-line/60 pb-6">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan uppercase tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
          CRYPTOGRAPHIC CREDENTIAL REGISTRY
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-ink">
          Certificates of Completion
        </h1>
        <p className="mt-2 max-w-2xl text-secondary text-sm sm:text-base leading-relaxed">
          Official verified performance credentials earned by demonstrating hands-on technical proficiency
          in CyberBLADE capstones and practical examinations.
        </p>
      </div>

      {/* Unclaimed Certificates Alert / Callout */}
      {unclaimedEligible.length > 0 && (
        <section aria-labelledby="unclaimed-heading" className="rounded-sm border border-cyan/60 bg-cyan/10 p-5 shadow-lg shadow-cyan/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan animate-ping" />
                <h2 id="unclaimed-heading" className="font-display text-base font-bold uppercase tracking-wider text-ink">
                  New Credential Eligible for Issuance!
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-secondary">
                You have met all completion criteria for {unclaimedEligible.length === 1 ? "a track" : `${unclaimedEligible.length} tracks`}.
                Claim your official certificate now.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {unclaimedEligible.map((u) => (
                <ClaimCertificateModal
                  key={`${u.trackId}:${u.level}`}
                  trackId={u.trackId}
                  trackTitle={u.trackTitle}
                  level={u.level}
                  defaultName={operator.handle}
                  triggerLabel={`Claim ${u.level} Certificate`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 1: Issued Certificates */}
      <section aria-labelledby="issued-heading" className="space-y-8">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <h2 id="issued-heading" className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            Issued Credentials ({issuedList.length})
          </h2>
          <span className="font-mono text-xs text-muted">REGISTRY: PUBLICLY VERIFIABLE</span>
        </div>

        {issuedList.length === 0 ? (
          <div className="rounded-sm border border-dashed border-line bg-surface/50 p-10 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
              <svg className="w-6 h-6 fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-display text-base font-bold uppercase text-ink">No Certificates Issued Yet</h3>
            <p className="mx-auto max-w-md text-xs text-secondary leading-relaxed">
              Complete foundational curriculum tracks and pass high-stakes capstone challenges or practical exams
              to earn your verified CyberBLADE certificate of completion.
            </p>
            <div className="pt-2">
              <Link
                href="/learn/core"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-cyan/60 bg-cyan/15 text-cyan hover:bg-cyan/25 font-ui text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                <span>Go to Shared Core Curriculum</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {issuedList.map((item) => (
              <article key={item.issuedCertificate!.id} className="space-y-4">
                <CertificateView
                  certificate={item.issuedCertificate!}
                  trackTitle={item.trackTitle}
                  showActions={true}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Track Status & Requirements */}
      <section aria-labelledby="track-status-heading" className="space-y-4 pt-6 border-t border-line/60">
        <h2 id="track-status-heading" className="font-display text-lg font-bold uppercase tracking-tight text-ink">
          Curriculum Track Credentials Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {eligibilities.map((t) => {
            const hasIssued = Boolean(t.issuedCertificate);
            return (
              <div
                key={`${t.trackId}:${t.level}`}
                className={`rounded-sm border p-4 flex flex-col justify-between transition-all ${
                  hasIssued
                    ? "border-emerald-500/40 bg-surface shadow-sm"
                    : t.eligible
                    ? "border-cyan/50 bg-cyan/5 shadow-md"
                    : "border-line bg-surface/40 opacity-80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      {t.trackId.toUpperCase()} TRACK
                    </span>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        hasIssued
                          ? "bg-emerald-500/15 text-emerald-400"
                          : t.eligible
                          ? "bg-cyan/20 text-cyan"
                          : "bg-surface-raised text-muted"
                      }`}
                    >
                      {hasIssued ? "EARNED" : t.eligible ? "ELIGIBLE" : "LOCKED"}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-base font-bold text-ink">
                    {t.trackTitle}
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-secondary font-semibold">
                    Level: {t.level}
                  </p>
                  <p className="mt-2 text-xs text-muted leading-relaxed">
                    {t.criteriaDescription}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60">
                  {hasIssued ? (
                    <Link
                      href={`/verify/${t.issuedCertificate!.credentialId}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full min-h-[44px] rounded-xs border border-line bg-surface hover:bg-surface-hover text-ink font-ui text-xs font-semibold transition-colors"
                    >
                      <span>Public Registry Record</span>
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ) : t.eligible ? (
                    <ClaimCertificateModal
                      trackId={t.trackId}
                      trackTitle={t.trackTitle}
                      level={t.level}
                      defaultName={operator.handle}
                      triggerLabel="Claim Certificate"
                    />
                  ) : (
                    <span className="block text-center font-mono text-xs text-muted py-2">
                      Prerequisites Incomplete
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

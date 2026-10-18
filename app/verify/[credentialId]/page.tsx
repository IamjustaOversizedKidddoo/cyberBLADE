import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isCertificatesEnabled } from "@/lib/config/env";
import { verifyCertificatePublic } from "@/lib/certificates/service";
import { CERTIFICATE_TRACKS } from "@/lib/certificates/eligibility";
import { CertificateView } from "@/components/certificates/CertificateView";

interface VerifyPageProps {
  params: Promise<{ credentialId: string }>;
}

export const metadata: Metadata = {
  title: "Verify Certificate of Completion | CyberBLADE Registry",
  description: "Official public verification for CyberBLADE certificates of completion.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
  if (!isCertificatesEnabled()) notFound();
  const { credentialId } = await params;
  const verified = await verifyCertificatePublic(credentialId);

  if (!verified) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-danger/60 bg-danger/10 text-danger">
          <svg className="w-8 h-8 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="space-y-2">
          <div className="font-mono text-xs uppercase tracking-widest text-danger">
            [VERIFICATION FAILED: RECORD NOT FOUND]
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-ink">
            Credential Not Recognized
          </h1>
          <p className="font-mono text-xs text-muted select-all">
            Query ID: {credentialId}
          </p>
        </div>

        <p className="max-w-md mx-auto text-xs sm:text-sm text-secondary leading-relaxed">
          No active or revoked certificate could be located in the CyberBLADE Verification Registry matching this identifier.
          Please confirm the link or contact the credential holder.
        </p>

        <div className="pt-4 border-t border-line/60">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xs border border-line bg-surface hover:bg-surface-hover text-ink font-ui text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            <span>Return to CyberBLADE Registry</span>
          </Link>
        </div>
      </main>
    );
  }

  const trackDef = CERTIFICATE_TRACKS.find(
    (t) => t.trackId === verified.trackId && t.level === verified.level,
  );
  const trackTitle = trackDef ? trackDef.trackTitle : `${verified.trackId.toUpperCase()} Track`;
  const isRevoked = verified.status === "revoked";

  // Synthesize CertificateRecord for visual rendering
  const certificateRecord = {
    id: verified.credentialId,
    userId: "verified-public",
    trackId: verified.trackId,
    level: verified.level,
    nameAsChosen: verified.nameAsChosen,
    credentialId: verified.credentialId,
    issuedAt: verified.issuedAt,
    revokedAt: verified.revokedAt ?? null,
    revocationReason: isRevoked ? "Honor code violation or administrative revocation" : null,
    scoreSnapshot: {},
    createdAt: verified.issuedAt,
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-8">
      {/* Registry Verification Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line/60 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <span
              className={`h-2 w-2 rounded-full ${
                isRevoked ? "bg-danger animate-pulse" : "bg-emerald-400 animate-ping"
              }`}
            />
            <span className={isRevoked ? "text-danger font-bold" : "text-emerald-400 font-bold"}>
              {isRevoked ? "REGISTRY STATUS: REVOKED" : "REGISTRY STATUS: VERIFIED AUTHENTIC"}
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-ink">
            Public Credential Verification
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            Official cryptographic record verified against the CyberBLADE integrity registry.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-line bg-surface hover:bg-surface-hover text-secondary hover:text-ink font-ui text-xs font-semibold uppercase tracking-wider transition-colors"
        >
          <span>CyberBLADE Platform</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>

      {/* Verified Summary Panel */}
      <section
        aria-labelledby="summary-heading"
        className={`rounded-sm border p-5 transition-all ${
          isRevoked
            ? "border-danger/60 bg-danger/10 text-danger"
            : "border-cyan/40 bg-surface shadow-sm"
        }`}
      >
        <h2 id="summary-heading" className="sr-only">Verified Credential Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div>
            <p className="font-mono text-[10px] text-muted uppercase">Conferred To</p>
            <p className="font-display text-base font-bold text-ink mt-0.5">{verified.nameAsChosen}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted uppercase">Curriculum Track</p>
            <p className="font-sans text-sm font-semibold text-ink mt-0.5">{trackTitle}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted uppercase">Classification</p>
            <p className="font-mono text-xs font-bold text-cyan mt-0.5">{verified.level}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted uppercase">Issue Date</p>
            <p className="font-mono text-xs text-ink mt-0.5">
              {new Date(verified.issuedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </section>

      {/* Full Visual Certificate */}
      <section aria-label="Official Certificate Presentation">
        <CertificateView
          certificate={certificateRecord}
          trackTitle={trackTitle}
          showActions={true}
        />
      </section>
    </main>
  );
}

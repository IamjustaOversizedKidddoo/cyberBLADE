import { createHash } from "node:crypto";
import QRCode from "qrcode";
import type { CertificateRecord } from "@/lib/certificates/types";
import { CertificateDownloadButtons } from "./CertificateDownloadButtons";
import { LinkedInShareButton } from "./LinkedInShareButton";

interface CertificateViewProps {
  certificate: CertificateRecord;
  trackTitle?: string;
  showActions?: boolean;
}

export async function CertificateView({
  certificate,
  trackTitle = "Cybersecurity Technical Mastery",
  showActions = true,
}: CertificateViewProps) {
  const isRevoked = Boolean(certificate.revokedAt);
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://cyberblade.dev";
  const verifyUrl = `${origin}/verify/${certificate.credentialId}`;

  // Generate SVG QR Code pointing directly to verify URL
  const qrSvg = await QRCode.toString(verifyUrl, {
    type: "svg",
    margin: 1,
    color: {
      dark: isRevoked ? "#ff3366" : "#00f0ff",
      light: "#0b0816",
    },
  });

  // Deterministic cryptographic integrity fingerprint
  const fingerprint = createHash("sha256")
    .update(`${certificate.credentialId}:${certificate.issuedAt}:${certificate.userId}`)
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();

  const formattedFingerprint = fingerprint.match(/.{1,4}/g)?.join(" ") ?? fingerprint;

  return (
    <div className="space-y-6">
      {/* Action Controls */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-4 print:hidden">
          <CertificateDownloadButtons credentialId={certificate.credentialId} />
          {!isRevoked && (
            <LinkedInShareButton
              trackTitle={trackTitle}
              level={certificate.level}
              credentialId={certificate.credentialId}
              issuedAt={certificate.issuedAt}
            />
          )}
        </div>
      )}

      {/* Revocation Warning Banner if Revoked */}
      {isRevoked && (
        <div className="rounded-xs border border-danger/80 bg-danger/15 p-4 text-center">
          <p className="font-display text-base font-bold uppercase tracking-wider text-danger">
            [STATUS: CREDENTIAL REVOKED]
          </p>
          <p className="mt-1 text-sm text-secondary">
            This certificate of completion was revoked on{" "}
            {new Date(certificate.revokedAt!).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}{" "}
            {certificate.revocationReason ? `(${certificate.revocationReason})` : ""}.
          </p>
        </div>
      )}

      {/* Outer Chassis: Double-Bezel Frame (taste-soft §4.A / taste-brutalist §5) */}
      <div
        id="cyberblade-certificate-chassis"
        className={`relative mx-auto w-full max-w-4xl overflow-hidden rounded-sm border p-3 sm:p-5 transition-all shadow-2xl ${
          isRevoked
            ? "border-danger/60 bg-surface-raised shadow-danger/10"
            : "border-cyan/40 bg-surface-raised shadow-cyan/10"
        }`}
      >
        {/* Corner registration marks */}
        <div className="absolute top-2 left-2 font-mono text-[9px] text-muted select-none">+ [0,0]</div>
        <div className="absolute top-2 right-2 font-mono text-[9px] text-muted select-none">[SEC:L1] +</div>
        <div className="absolute bottom-2 left-2 font-mono text-[9px] text-muted select-none">+ [CBL_AUTH]</div>
        <div className="absolute bottom-2 right-2 font-mono text-[9px] text-muted select-none">[SHA256] +</div>

        {/* Inner Console Core: High-Precision Vector Certificate */}
        <div className="relative rounded-xs border border-line/80 bg-void/90 p-6 sm:p-10 text-center backdrop-blur-md">
          {/* Subtle Guilloche Rosette Watermark Background */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] overflow-hidden" aria-hidden="true">
            <svg className="w-[800px] h-[800px]" viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
              <polygon points="200,20 355,110 355,290 200,380 45,290 45,110" fill="none" stroke="currentColor" strokeWidth="1" />
              <polygon points="200,45 334,122 334,277 200,355 65,277 65,122" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>

          {/* Certificate Header */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Emblem */}
            <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-cyan uppercase">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan animate-pulse" />
              CYBERBLADE VERIFICATION REGISTRY
            </div>

            <h1 className="mt-4 font-display text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-ink sm:leading-tight">
              Certificate of Completion
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
              Performance-Based Technical Credential · Handshake Verified
            </p>

            <div className="my-5 h-px w-24 bg-gradient-to-r from-transparent via-cyan to-transparent" />

            {/* Conferred upon text */}
            <p className="font-ui text-xs tracking-wider uppercase text-secondary">
              This credential is proud conferred upon
            </p>

            {/* Recipient Display Name */}
            <div className="mt-2 mb-4 font-display text-2xl sm:text-4xl font-bold uppercase tracking-tight text-ink border-b-2 border-cyan/40 pb-2 px-6">
              {certificate.nameAsChosen}
            </div>

            {/* Statement of Achievement */}
            <p className="max-w-xl text-xs sm:text-sm text-secondary leading-relaxed">
              For successful performance-based completion of all practical laboratory objectives,
              incident response criteria, and rigorous hands-on assessments in:
            </p>

            {/* Track & Level Title */}
            <div className="mt-4 rounded-xs border border-line bg-surface/80 px-5 py-3">
              <p className="font-display text-lg sm:text-xl font-bold uppercase tracking-wide text-ink">
                {trackTitle}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full bg-cyan/15 px-3 py-0.5 font-mono text-xs font-semibold text-cyan uppercase tracking-wider">
                  Classification: {certificate.level}
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${
                    isRevoked ? "bg-danger/20 text-danger" : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {isRevoked ? "Status: Revoked" : "Status: Active & Verified"}
                </span>
              </div>
            </div>

            {/* Metadata & Signatures Grid */}
            <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-3 items-end gap-6 border-t border-line/60 pt-6 text-left">
              {/* QR Code and Credential Serial */}
              <div className="flex flex-col items-center sm:items-start gap-2">
                <div
                  className="w-24 h-24 rounded-xs border border-line bg-surface p-1 shadow-sm [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                  aria-label="Verification QR code"
                />
                <div className="text-center sm:text-left">
                  <p className="font-mono text-[10px] text-muted uppercase">Credential ID</p>
                  <p className="font-mono text-xs font-bold text-ink select-all">{certificate.credentialId}</p>
                </div>
              </div>

              {/* Central Seal & Cryptographic Proof */}
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan/60 bg-surface shadow-inner">
                  <svg className="w-8 h-8 text-cyan fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                  </svg>
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                  Cryptographic Integrity Seal
                </p>
                <p className="mt-0.5 font-mono text-[9px] text-secondary tracking-widest select-all">
                  {formattedFingerprint}
                </p>
              </div>

              {/* Signatures & Issue Date */}
              <div className="flex flex-col items-center sm:items-end text-center sm:text-right space-y-3">
                <div>
                  <div className="font-serif italic text-base text-ink opacity-90 select-none">
                    Director of Evaluator Directorate
                  </div>
                  <div className="h-px w-36 bg-line/80 my-1 ml-auto" />
                  <p className="font-mono text-[10px] uppercase text-muted">Chief Evaluator, CyberBLADE</p>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase text-muted">Issued Date</p>
                  <p className="font-mono text-xs font-semibold text-ink">{issuedDate}</p>
                </div>
              </div>
            </div>

            {/* Honest Attribution Footnote (Requirement 5 & Standing Rule 4) */}
            <div className="mt-8 border-t border-line/40 pt-4 text-center">
              <p className="max-w-2xl font-sans text-[11px] text-muted leading-relaxed">
                CyberBLADE Certificate of Completion. Issued independently by CyberBLADE. This credential
                certifies completion of performance-based exercises, interactive simulations, and technical
                capstones on the CyberBLADE learning platform. It does not imply endorsement by, sponsorship by,
                or affiliation with CompTIA, TryHackMe, OffSec, or other third-party vendor certification programs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

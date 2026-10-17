"use client";

interface LinkedInShareButtonProps {
  trackTitle: string;
  level: string;
  credentialId: string;
  issuedAt: string;
  className?: string;
}

export function LinkedInShareButton({
  trackTitle,
  level,
  credentialId,
  issuedAt,
  className = "",
}: LinkedInShareButtonProps) {
  const date = new Date(issuedAt);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  const certName = `CyberBLADE: ${trackTitle} (${level})`;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://cyberblade.dev";
  const verifyUrl = `${origin}/verify/${credentialId}`;

  const linkedInUrl = new URL("https://www.linkedin.com/profile/add");
  linkedInUrl.searchParams.set("startTask", "CERTIFICATION_NAME");
  linkedInUrl.searchParams.set("name", certName);
  linkedInUrl.searchParams.set("organizationName", "CyberBLADE");
  linkedInUrl.searchParams.set("issueYear", String(year));
  linkedInUrl.searchParams.set("issueMonth", String(month));
  linkedInUrl.searchParams.set("certUrl", verifyUrl);
  linkedInUrl.searchParams.set("certId", credentialId);

  return (
    <a
      href={linkedInUrl.toString()}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-[#0a66c2]/80 bg-[#0a66c2]/15 text-[#70b5f9] hover:bg-[#0a66c2]/25 hover:text-white font-ui text-sm tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2] ${className}`}
    >
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.8v8.37h-2.8V10.9M7.86 6.54a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26Z" />
      </svg>
      <span>Add to LinkedIn</span>
    </a>
  );
}

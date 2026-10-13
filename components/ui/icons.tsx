import type { SVGProps } from "react";

export function IconCheck({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconCross({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function IconLock({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

export function IconUnlock({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0" />
    </svg>
  );
}

export function IconTerminal({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <polyline points="4 17 10 11 4 5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="19" x2="20" y2="19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconShield({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconSearch({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function IconChevronRight({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function IconChevronLeft({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function IconChevronDown({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7 7" />
    </svg>
  );
}

export function IconCopy({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function IconAlertTriangle({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconInfo({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
      <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeWidth={2.5} />
    </svg>
  );
}

export function IconPlay({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" className={className} {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function IconRotateCcw({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 4v6h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

export function IconClock({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBook({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

export function IconSparkles({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

export function IconEye({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconExternalLink({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* SIEM Severity indicator shapes (accessible shape distinction beyond color alone) */
export function IconFlame({ className = "h-3.5 w-3.5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" className={className} {...props}>
      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.527.82-1.124 2.062-1.123 3.515 0 .307.034.604.098.89a6.002 6.002 0 00-3.69 4.886c-.05.418.17.818.536.983a4.01 4.01 0 003.54-.153 2.5 2.5 0 004.032-1.996c0-.528-.164-1.02-.45-1.428a1.002 1.002 0 01.378-1.503c1.077-.557 2.115-1.554 2.115-3.082 0-1.493-1.01-2.905-2.61-3.607z" clipRule="evenodd" />
    </svg>
  );
}

export function IconHexagon({ className = "h-3.5 w-3.5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" className={className} {...props}>
      <polygon points="12 2 21 7.2 21 16.8 12 22 3 16.8 3 7.2" />
    </svg>
  );
}

export function IconSquare({ className = "h-3.5 w-3.5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" className={className} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export function IconCircle({ className = "h-3.5 w-3.5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" className={className} {...props}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function IconVolume2({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
    </svg>
  );
}

export function IconVolumeX({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
      <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
    </svg>
  );
}

export const IconClose = IconCross;

export function IconGlobe({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function IconMail({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function IconFile({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export function IconActivity({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function IconArrowRight({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconLayers({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function IconDownload({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconPaperclip({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function IconKey({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} {...props}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3" />
    </svg>
  );
}



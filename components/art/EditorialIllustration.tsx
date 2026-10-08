import Image from "next/image";

type Slot = "operator" | "system" | "signal";

type Props = {
  slot: Slot;
  /** What the artwork shows. Required unless the art is purely decorative. */
  alt?: string;
  decorative?: boolean;
  caption?: string;
  /** Final illustration; until it exists the slot renders its designed placeholder. */
  src?: string;
  /** object-position focal points per breakpoint, e.g. { mobile: "50% 20%", desktop: "50% 40%" }. */
  crop?: { mobile?: string; desktop?: string };
  className?: string;
};

const RATIO: Record<Slot, string> = { operator: "5 / 6", system: "4 / 3", signal: "1 / 1" };

// Head-and-shoulders silhouette of an anonymous operator, drawn for NEON (200×240 box).
const BUST =
  "M100 18 C132 18 150 44 150 78 C150 104 140 124 126 136 L124 150 C150 156 178 166 192 184 L198 240 L2 240 L8 184 C22 166 50 156 76 150 L74 136 C60 124 50 104 50 78 C50 44 68 18 100 18 Z";
const maskOf = (d: string, box: string) => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}'><path d='${d}'/></svg>")`;

/** Halftone dots clipped to a shape: the print texture that fills NEON's ink figures. */
function Dots({ d, box, className }: { d: string; box: string; className?: string }) {
  const mask = maskOf(d, box);
  return (
    <div
      className={`absolute inset-0 ${className ?? ""}`}
      style={{
        backgroundImage: "radial-gradient(currentColor 1.6px, transparent 2.2px)",
        backgroundSize: "7px 7px",
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
      }}
    />
  );
}

function Operator() {
  return (
    <>
      {/* pink mis-registration: the second print plate slipped a few millimetres */}
      <Dots d={BUST} box="0 0 200 240" className="translate-x-[7%] translate-y-[3%] text-pink opacity-50" />
      <Dots d={BUST} box="0 0 200 240" />
      <svg viewBox="0 0 200 240" className="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="100" cy="78" r="70" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6" />
        <path d="M100 0 V12 M100 144 V156 M22 78 H34 M166 78 H178" strokeWidth="1" />
        <path d={BUST} strokeWidth="3" />
        <path d="M76 150 L100 178 L124 150 M100 178 V240 M58 196 L72 214 M142 196 L128 214" strokeWidth="2" />
        <path d="M72 120 L100 132 L128 120" strokeWidth="1.6" />
        {/* the visor: a simulation-only headset, NEON cyan */}
        <path d="M46 66 L156 59 L158 87 L48 93 Z" fill="var(--color-cyan)" stroke="currentColor" strokeWidth="3" />
        <path d="M54 72 L150 66 M54 78 L151 72 M55 84 L152 78" stroke="var(--color-void)" strokeWidth="1.2" opacity="0.55" />
        <path d="M6 6 H18 M6 6 V18 M194 234 H182 M194 234 V222" strokeWidth="1.5" />
      </svg>
    </>
  );
}

function System() {
  return (
    <svg viewBox="0 0 240 180" className="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" strokeLinecap="round">
      <rect x="20" y="14" width="200" height="124" strokeWidth="3" />
      <rect x="32" y="26" width="176" height="100" fill="var(--color-void)" stroke="none" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M42 ${42 + i * 16} H${90 + ((i * 47) % 100)}`} stroke="var(--color-cyan)" strokeWidth="3" />
      ))}
      <rect x="44" y="104" width="10" height="12" fill="var(--color-pink)" stroke="none" />
      <path d="M100 138 V156 M70 166 H170 M120 156 V166" strokeWidth="3" />
      <path d="M220 60 C246 70 244 120 230 150" strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  );
}

function Signal() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" strokeLinecap="round">
      {[30, 55, 80].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} strokeWidth="1.2" strokeDasharray="2 6" />
      ))}
      <path d="M10 100 H40 L52 70 L64 132 L76 84 L88 116 L100 100 H190" stroke="var(--color-cyan)" strokeWidth="3" />
      <circle cx="100" cy="100" r="5" fill="var(--color-pink)" stroke="none" />
      <path d="M100 100 L156 44" strokeWidth="2" />
    </svg>
  );
}

const PLACEHOLDER: Record<Slot, () => React.ReactNode> = { operator: Operator, system: System, signal: Signal };

/**
 * An art slot for a figurative illustration. With `src` it shows the final artwork; without, a
 * composed NEON placeholder (ink + halftone + accent) so the page never shows an empty box.
 */
export function EditorialIllustration({ slot, alt, decorative, caption, src, crop, className = "" }: Props) {
  if (!alt && !decorative) throw new Error(`EditorialIllustration "${slot}" needs alt text (or decorative).`);
  const Placeholder = PLACEHOLDER[slot];
  const art = src ? (
    <Image
      src={src}
      alt={decorative ? "" : alt!}
      fill
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="object-cover [object-position:var(--crop-mobile)] lg:[object-position:var(--crop-desktop)]"
      style={{ "--crop-mobile": crop?.mobile ?? "50% 50%", "--crop-desktop": crop?.desktop ?? "50% 50%" } as React.CSSProperties}
    />
  ) : (
    <div role={decorative ? undefined : "img"} aria-label={decorative ? undefined : alt} className="absolute inset-0">
      <Placeholder />
    </div>
  );
  return (
    <figure aria-hidden={decorative ? "true" : undefined} className={`relative ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: RATIO[slot] }}>
        {art}
      </div>
      {caption && <figcaption className="mt-2 font-ui text-xs tracking-wider sm:text-sm">{caption}</figcaption>}
    </figure>
  );
}

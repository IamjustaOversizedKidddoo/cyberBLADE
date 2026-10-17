import { PosterSection } from "@/components/art/PosterSection";
import { GlitchText } from "./GlitchText";
import { TypingText } from "./TypingText";

type Props = {
  title: string;
  kicker?: string;
  tone?: "paper" | "void";
  children?: React.ReactNode;
};

/**
 * Tactical console banner for curriculum, labs and mission screens.
 * Uses tone="void" by default for high-contrast dark console legibility.
 */
export function HeroBand({ title, kicker, tone = "void", children }: Props) {
  return (
    <PosterSection tone={tone} className="neon-hero border-b border-line py-8 sm:py-12 bg-void">
      <div className="col-span-full mx-auto w-full max-w-5xl">
        {kicker && (
          <p className="mb-2 font-mono text-xs sm:text-sm tracking-wider text-cyan uppercase">
            <TypingText text={kicker} />
          </p>
        )}
        <GlitchText as="h1" className="break-words text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display uppercase tracking-tight text-ink leading-[0.95]">
          {title}
        </GlitchText>
        {children && <div className="mt-3 max-w-[65ch] text-sm sm:text-base text-muted leading-relaxed">{children}</div>}
      </div>
    </PosterSection>
  );
}

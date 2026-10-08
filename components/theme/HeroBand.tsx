import { PosterSection } from "@/components/art/PosterSection";
import { GlitchText } from "./GlitchText";
import { TypingText } from "./TypingText";

type Props = { title: string; kicker?: string; children?: React.ReactNode };

/**
 * Near-white band with a huge black Hacked heading — the simple poster band used by pages that
 * aren't art-directed yet (lessons, labs, legal). Built on PosterSection so it shares the band tokens.
 */
export function HeroBand({ title, kicker, children }: Props) {
  return (
    <PosterSection tone="paper" className="neon-hero py-12 sm:py-20">
      <div className="col-span-full mx-auto w-full max-w-5xl">
        {kicker && (
          <p className="mb-4 text-lg sm:text-xl">
            <TypingText text={kicker} />
          </p>
        )}
        <GlitchText as="h1" className="break-words text-[clamp(3.5rem,12vw,8rem)]">
          {title}
        </GlitchText>
        {children && <div className="mt-6 max-w-[60ch] text-lg text-void/80">{children}</div>}
      </div>
    </PosterSection>
  );
}

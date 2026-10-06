import { GlitchText } from "./GlitchText";
import { TypingText } from "./TypingText";

type Props = { title: string; kicker?: string; children?: React.ReactNode };

/** Near-white band with a huge black Hacked heading. */
export function HeroBand({ title, kicker, children }: Props) {
  return (
    <section className="bg-paper px-4 py-12 text-void sm:py-20">
      <div className="mx-auto max-w-5xl">
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
    </section>
  );
}

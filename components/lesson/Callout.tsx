type Props = { tone?: "info" | "warn" | "law"; title?: string; children: React.ReactNode };

const TONES = {
  info: "border-cyan text-cyan",
  warn: "border-pink text-pink",
  law: "border-purple text-purple",
} as const;

/** Side note in a lesson: <Callout tone="law" title="Legal">…</Callout> */
export function Callout({ tone = "info", title, children }: Props) {
  return (
    <aside className={`my-6 border-l-2 bg-white/[0.03] px-4 py-3 ${TONES[tone]}`}>
      {title && <p className="font-ui">{title}</p>}
      <div className="text-ink/90 [&>p]:my-2">{children}</div>
    </aside>
  );
}

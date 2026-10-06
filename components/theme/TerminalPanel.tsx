import { BlinkCursor } from "./BlinkCursor";

type Props = { title?: string; children: React.ReactNode; className?: string };

export function TerminalPanel({ title, children, className }: Props) {
  return (
    <section className={`border border-line bg-void ${className ?? ""}`}>
      {title && (
        <div className="border-b border-line px-4 py-2 font-ui text-muted">
          {title}
          <BlinkCursor />
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

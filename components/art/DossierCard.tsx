import { NoiseLayer } from "./NoiseLayer";
import { SystemLabel } from "./SystemLabel";

type Props = {
  fileNo: string;
  title: string;
  /** Rubber-stamp word (OPEN, CLASSIFIED, ACTIVE…). */
  stamp?: string;
  stampTone?: "pink" | "cyan" | "purple";
  /** Replace the body with redaction bars: the words are removed from the page, not just covered. */
  redact?: boolean;
  /** Heading level for the title (keeps the page outline correct). */
  as?: "h2" | "h3";
  className?: string;
  children?: React.ReactNode;
};

const STAMP: Record<NonNullable<Props["stampTone"]>, string> = { pink: "text-pink border-pink", cyan: "text-cyan border-cyan", purple: "text-purple border-purple" };

/** A paper file: file number, rubber stamp, title, contents. For briefings, operator files, track dossiers. */
export function DossierCard({ fileNo, title, stamp, stampTone = "pink", redact, as: Title = "h3", className = "", children }: Props) {
  return (
    <article className={`dossier relative overflow-hidden border-2 border-void bg-paper p-5 text-void shadow-[6px_6px_0_0_var(--color-void)] ${className}`}>
      <NoiseLayer kind="photocopy" />
      <div className="relative flex items-start justify-between gap-4">
        <SystemLabel tone="void">{fileNo}</SystemLabel>
        {stamp && (
          <span className={`-rotate-6 border-2 px-2 py-0.5 font-ui text-sm tracking-widest ${STAMP[stampTone]}`}>{stamp}</span>
        )}
      </div>
      <Title className="relative mt-3 font-ui text-2xl leading-tight">{title}</Title>
      <div className="relative mt-3">
        {redact ? (
          <p>
            <span className="sr-only">Contents redacted.</span>
            <span aria-hidden="true" className="flex flex-col gap-2">
              <span className="block h-3 w-11/12 bg-void" />
              <span className="block h-3 w-3/4 bg-void" />
              <span className="block h-3 w-5/6 bg-void" />
            </span>
          </p>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

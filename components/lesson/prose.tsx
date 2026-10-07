import type { MDXComponents } from "mdx/types";

/**
 * Lesson typography (Phase 0 theme roles): ## in Hacked, ### in Pixel Operator, prose in the
 * readable sans, code in mono with horizontal scroll inside the block only.
 */
export const proseComponents: MDXComponents = {
  h2: (p) => <h2 className="mb-4 mt-14 text-4xl text-ink first:mt-0" {...p} />,
  h3: (p) => <h3 className="mb-3 mt-8 text-xl text-cyan" {...p} />,
  h4: (p) => <h4 className="mb-2 mt-6 text-lg text-ink" {...p} />,
  p: (p) => <p className="my-4 text-ink/90" {...p} />,
  ul: (p) => <ul className="my-4 list-disc space-y-1 pl-6" {...p} />,
  ol: (p) => <ol className="my-4 list-decimal space-y-1 pl-6" {...p} />,
  li: (p) => <li className="text-ink/90" {...p} />,
  a: (p) => <a className="text-cyan underline" {...p} />,
  strong: (p) => <strong className="font-semibold text-ink" {...p} />,
  blockquote: (p) => <blockquote className="my-6 border-l-2 border-purple pl-4 text-muted" {...p} />,
  pre: (p) => <pre className="my-6 overflow-x-auto border border-line bg-[#05070a] p-4 text-sm leading-relaxed" {...p} />,
  code: (p) => <code className="font-mono text-[0.92em]" {...p} />,
  table: (p) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="border-b border-line px-3 py-2 font-ui text-ink" {...p} />,
  td: (p) => <td className="border-b border-line/50 px-3 py-2 align-top text-ink/90" {...p} />,
  hr: () => <hr className="my-10 border-line" />,
};

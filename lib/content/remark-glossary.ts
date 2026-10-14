/**
 * Remark plugin: wraps the first use of each glossary term in a lesson's prose with a <GlossaryTerm>
 * element, so readers can see the definition without leaving the page. Only plain text inside
 * paragraphs, list items, table cells and emphasis is touched: never headings, code, links or JSX.
 */
export type TooltipTerm = { term: string; definition: string; href: string };

type Node = { type: string; value?: string; children?: Node[]; name?: string; attributes?: unknown[] };

const SKIP = new Set(["heading", "code", "inlineCode", "link", "linkReference", "mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "html", "blockquote"]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function remarkGlossary(options: { terms: TooltipTerm[] }) {
  // Longest first, so "Benign true positive" wins over "True positive".
  const terms = [...options.terms].sort((a, b) => b.term.length - a.term.length);
  const patterns = terms.map((t) => ({ t, re: new RegExp(`(^|[^\\w-])(${escapeRegExp(t.term)})(?=$|[^\\w-])`, "i") }));

  return (tree: Node) => {
    const used = new Set<string>();
    const walk = (node: Node) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (SKIP.has(child.type)) continue;
        if (child.type !== "text" || !child.value) {
          walk(child);
          continue;
        }
        for (const { t, re } of patterns) {
          if (used.has(t.term.toLowerCase())) continue;
          const m = re.exec(child.value);
          if (!m) continue;
          used.add(t.term.toLowerCase());
          const start = m.index + m[1].length;
          const end = start + m[2].length;
          const element: Node = {
            type: "mdxJsxTextElement",
            name: "GlossaryTerm",
            attributes: [
              { type: "mdxJsxAttribute", name: "definition", value: t.definition },
              { type: "mdxJsxAttribute", name: "href", value: t.href },
              { type: "mdxJsxAttribute", name: "term", value: t.term },
            ],
            children: [{ type: "text", value: child.value.slice(start, end) }],
          };
          const replacement: Node[] = [];
          if (start > 0) replacement.push({ type: "text", value: child.value.slice(0, start) });
          replacement.push(element);
          if (end < child.value.length) replacement.push({ type: "text", value: child.value.slice(end) });
          node.children.splice(i, 1, ...replacement);
          // Continue scanning after the inserted element (the trailing text may hold other terms).
          i += replacement.indexOf(element);
          break;
        }
      }
    };
    walk(tree);
  };
}

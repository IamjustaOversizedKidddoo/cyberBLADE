import { evaluate } from "@mdx-js/mdx";
import type { MDXComponents } from "mdx/types";
import type { ReactElement } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";

/**
 * Compiles repo-authored MDX (trusted content) on the server.
 * `format: "md"` is for plain Markdown such as lab briefings.
 */
export async function renderMdx(source: string, components: MDXComponents = {}, format: "mdx" | "md" = "mdx"): Promise<ReactElement> {
  const { default: Content } = await evaluate(source, { ...runtime, format, remarkPlugins: [remarkGfm] });
  return Content({ components });
}

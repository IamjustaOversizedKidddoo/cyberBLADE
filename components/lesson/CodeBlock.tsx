"use client";

import { useState, type ReactNode } from "react";
import { IconCopy, IconCheck } from "@/components/ui/icons";

export function CodeBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      // Find the code element text
      const pre = document.querySelector(".active-code-pre");
      const text = pre?.textContent ?? "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  }

  return (
    <div className={`relative group my-6 overflow-hidden rounded-sm border border-line bg-surface-subtle ${className}`}>
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-line/60 bg-surface px-3.5 py-1.5 font-mono text-[11px] text-muted">
        <span className="uppercase tracking-wider">COMMAND / CODE</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code"}
          className="flex items-center gap-1.5 text-muted hover:text-cyan transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan rounded-xs px-1.5 py-0.5"
        >
          {copied ? (
            <>
              <IconCheck className="h-3 w-3 text-success" />
              <span className="text-success text-[10px]">COPIED</span>
            </>
          ) : (
            <>
              <IconCopy className="h-3 w-3" />
              <span className="text-[10px]">COPY</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-ink/90">
        {children}
      </div>
    </div>
  );
}

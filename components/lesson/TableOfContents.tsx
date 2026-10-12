"use client";

import { useEffect, useState } from "react";

interface HeadingItem {
  id: string;
  text: string;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Find all h2 and h3 elements within article
    const elements = Array.from(document.querySelectorAll("article h2, article h3"));
    const items = elements.map((el, i) => {
      let id = el.id;
      if (!id) {
        id = `section-${i}-${el.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? ""}`;
        el.id = id;
      }
      return { id, text: el.textContent ?? "" };
    });

    function onScroll() {
      const scrollPos = window.scrollY + 120;
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el && el.getBoundingClientRect().top + window.scrollY <= scrollPos) {
          setActiveId(el.id);
          break;
        }
      }
    }

    const frame = requestAnimationFrame(() => {
      setHeadings(items);
      onScroll();
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (headings.length < 2) return null;

  return (
    <>
      {/* Mobile Collapsible Table of Contents Disclosure */}
      <div className="xl:hidden w-full mb-6">
        <details className="rounded-sm border border-line bg-surface/80 p-3 text-xs group">
          <summary className="font-ui font-semibold text-ink cursor-pointer list-none flex items-center justify-between min-h-[44px] select-none">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              <span className="tracking-wider uppercase">Table of Contents</span>
            </span>
            <span className="font-mono text-cyan text-xs group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <ul className="mt-3 space-y-2 border-t border-line/60 pt-3 pl-2 font-sans">
            {headings.map((h) => {
              const isActive = activeId === h.id;
              return (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={`block py-1 transition-colors leading-snug ${
                      isActive ? "text-cyan font-bold" : "text-muted hover:text-ink"
                    }`}
                  >
                    {h.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      </div>

      {/* Desktop Sticky Table of Contents Sidebar */}
      <nav
        aria-label="Table of contents"
        className="hidden xl:block sticky top-24 w-60 shrink-0 self-start p-4 rounded-sm border border-line bg-surface/60 backdrop-blur-xs text-xs"
      >
        <div className="font-ui font-semibold text-muted tracking-wider uppercase mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
          <span>CONTENTS</span>
        </div>
        <ul className="space-y-2 border-l border-line/60 pl-3 font-sans">
          {headings.map((h) => {
            const isActive = activeId === h.id;
            return (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={`block transition-colors leading-snug truncate ${
                    isActive
                      ? "text-cyan font-medium -ml-[13px] pl-3 border-l-2 border-cyan"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {h.text}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 pt-3 border-t border-line/40">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="text-muted/60 hover:text-cyan font-ui text-[11px] tracking-wider transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            <span>↑ BACK TO TOP</span>
          </button>
        </div>
      </nav>
    </>
  );
}

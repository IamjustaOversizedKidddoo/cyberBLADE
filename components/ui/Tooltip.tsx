"use client";

import { useState, useId, type ReactNode } from "react";

export function Tooltip({
  content,
  children,
  position = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom";
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  const posClass =
    position === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : "top-full left-1/2 -translate-x-1/2 mt-2";

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <div aria-describedby={visible ? id : undefined} className="inline-flex">
        {children}
      </div>
      {visible && (
        <div
          role="tooltip"
          id={id}
          className={`absolute ${posClass} z-50 pointer-events-none whitespace-nowrap rounded-xs border border-cyan/40 bg-surface-raised px-2.5 py-1 font-ui text-[11px] tracking-wide text-ink shadow-[0_4px_12px_rgba(0,0,0,0.6)] animate-in fade-in duration-150`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

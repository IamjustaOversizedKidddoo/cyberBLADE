import type { HTMLAttributes, ReactNode } from "react";

export function Kbd({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded-xs border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink shadow-[0_1px_0_1px_rgba(0,0,0,0.4)] ${className}`}
      {...props}
    >
      {children}
    </kbd>
  );
}

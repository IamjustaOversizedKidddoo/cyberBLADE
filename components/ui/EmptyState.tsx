import type { ReactNode } from "react";
import { IconSearch } from "./icons";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-sm border border-dashed border-line bg-surface-subtle/50 px-6 py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        {icon ?? <IconSearch className="h-6 w-6" />}
      </div>
      <h3 className="font-ui text-sm font-semibold tracking-wider uppercase text-ink">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm font-sans text-xs text-muted leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

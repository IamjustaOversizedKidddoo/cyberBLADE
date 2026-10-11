import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xs bg-surface-raised border border-line/40 ${className}`}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading card data"
      className="rounded-sm border border-line bg-surface p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <div className="pt-2 flex items-center gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

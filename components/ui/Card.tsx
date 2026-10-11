import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "raised" | "subtle";
export type CardEdge = "cyan" | "emerald" | "amber" | "rose" | "purple";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  edge?: CardEdge;
  hoverable?: boolean;
  children: ReactNode;
}

export function Card({
  variant = "default",
  edge,
  hoverable = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default: "bg-surface border border-line",
    raised: "bg-surface-raised border border-line shadow-lg",
    subtle: "bg-surface-subtle border border-line/60",
  }[variant];

  const edgeStyles = edge
    ? {
        cyan: "border-l-4 border-l-cyan",
        emerald: "border-l-4 border-l-success",
        amber: "border-l-4 border-l-warning",
        rose: "border-l-4 border-l-danger",
        purple: "border-l-4 border-l-purple",
      }[edge]
    : "";

  const hoverStyles = hoverable
    ? "transition-all duration-200 hover:border-cyan/50 hover:bg-surface-hover hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
    : "";

  return (
    <div
      className={`relative overflow-hidden rounded-sm ${variantStyles} ${edgeStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-b border-line/60 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-t border-line/60 bg-surface-subtle/50 px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

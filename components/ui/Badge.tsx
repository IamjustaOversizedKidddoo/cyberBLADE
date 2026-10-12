import type { HTMLAttributes, ReactNode } from "react";
import {
  IconCheck,
  IconLock,
  IconClock,
  IconPlay,
  IconFlame,
  IconHexagon,
  IconSquare,
  IconCircle,
  IconInfo,
} from "./icons";
import { rankName } from "@/lib/progress/ranks";

export type BadgeVariant =
  | "default"
  | "cyan"
  | "purple"
  | "emerald"
  | "amber"
  | "danger"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  children: ReactNode;
}

export function Badge({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  }[size];

  const variantStyles = {
    default: "bg-surface text-ink border border-line",
    cyan: "bg-cyan/10 text-cyan border border-cyan/40",
    purple: "bg-purple/10 text-purple border border-purple/40",
    emerald: "bg-success/10 text-success border border-success/40",
    amber: "bg-warning/10 text-warning border border-warning/40",
    danger: "bg-danger/10 text-danger border border-danger/40",
    outline: "bg-transparent text-muted border border-line",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-ui font-medium tracking-wider rounded-xs uppercase select-none ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export type StatusType = "COMPLETED" | "AVAILABLE" | "LOCKED" | "IN_PROGRESS";

export function StatusBadge({
  status,
  size = "md",
  className = "",
}: {
  status: StatusType;
  size?: "sm" | "md";
  className?: string;
}) {
  const config = {
    COMPLETED: {
      label: "COMPLETED",
      variant: "emerald" as const,
      icon: <IconCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />,
    },
    AVAILABLE: {
      label: "AVAILABLE",
      variant: "cyan" as const,
      icon: <IconPlay className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />,
    },
    IN_PROGRESS: {
      label: "IN PROGRESS",
      variant: "amber" as const,
      icon: <IconClock className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />,
    },
    LOCKED: {
      label: "LOCKED",
      variant: "outline" as const,
      icon: <IconLock className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />,
    },
  }[status];

  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  );
}

export function RankBadge({
  rank,
  size = "md",
  className = "",
}: {
  rank: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rankColors = [
    "border-slate-500/50 bg-slate-500/10 text-slate-300", // Rank 0 Initiate
    "border-cyan/50 bg-cyan/10 text-cyan", // Rank 1 Operator
    "border-purple/50 bg-purple/10 text-purple", // Rank 2 Watcher
    "border-amber-500/50 bg-amber-500/10 text-amber-400", // Rank 3 Hunter
  ];

  const colorClass = rankColors[rank] ?? rankColors[0];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-ui font-semibold tracking-wider rounded-xs border uppercase select-none ${sizeClass} ${colorClass} ${className}`}
    >
      <span aria-hidden="true" className="font-mono text-[10px] font-bold">
        R{rank}
      </span>
      <span>{rankName(rank)}</span>
    </span>
  );
}

export type SeverityType = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export function SeverityBadge({
  severity,
  className = "",
}: {
  severity: SeverityType | string;
  className?: string;
}) {
  const norm = severity.toUpperCase() as SeverityType;
  const config = {
    CRITICAL: {
      label: "CRITICAL",
      icon: <IconFlame className="h-3 w-3 text-danger" />,
      style: "border-danger/40 bg-danger/15 text-danger font-bold",
    },
    HIGH: {
      label: "HIGH",
      icon: <IconHexagon className="h-3 w-3 text-orange-400" />,
      style: "border-orange-500/40 bg-orange-500/15 text-orange-400 font-semibold",
    },
    MEDIUM: {
      label: "MEDIUM",
      icon: <IconSquare className="h-3 w-3 text-yellow-400" />,
      style: "border-yellow-500/40 bg-yellow-500/15 text-yellow-400 font-medium",
    },
    LOW: {
      label: "LOW",
      icon: <IconCircle className="h-3 w-3 text-cyan" />,
      style: "border-cyan/40 bg-cyan/15 text-cyan",
    },
    INFO: {
      label: "INFO",
      icon: <IconInfo className="h-3 w-3 text-muted" />,
      style: "border-line bg-surface text-muted",
    },
  }[norm] ?? {
    label: norm,
    icon: <IconInfo className="h-3 w-3 text-muted" />,
    style: "border-line bg-surface text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 font-ui text-[11px] tracking-wider uppercase select-none ${config.style} ${className}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

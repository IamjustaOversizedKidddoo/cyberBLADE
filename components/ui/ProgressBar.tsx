import type { HTMLAttributes } from "react";

export type ProgressBarVariant = "cyan" | "emerald" | "amber" | "purple";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  variant?: ProgressBarVariant;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  variant = "cyan",
  size = "md",
  showLabel = false,
  label,
  className = "",
  ...props
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizeClass = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  const fillClass = {
    cyan: "bg-cyan shadow-[0_0_8px_rgba(15,190,255,0.4)]",
    emerald: "bg-success shadow-[0_0_8px_rgba(16,185,129,0.4)]",
    amber: "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.4)]",
    purple: "bg-purple shadow-[0_0_8px_rgba(200,60,255,0.4)]",
  }[variant];

  return (
    <div className={`w-full ${className}`} {...props}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between font-ui text-xs text-muted">
          <span>{label ?? "Progress"}</span>
          <span className="font-mono text-ink font-semibold">{percent}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `${percent}% completed`}
        className={`w-full overflow-hidden rounded-xs bg-surface-raised border border-line/60 ${sizeClass}`}
      >
        <div
          className={`h-full transition-all duration-300 ease-out ${fillClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

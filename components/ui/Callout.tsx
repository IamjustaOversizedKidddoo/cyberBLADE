import type { ReactNode } from "react";
import { IconInfo, IconSparkles, IconAlertTriangle, IconFlame } from "./icons";

export type CalloutVariant = "info" | "tip" | "warning" | "danger";

export function Callout({
  variant = "info",
  title,
  children,
  className = "",
}: {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const config = {
    info: {
      border: "border-l-4 border-l-cyan border-line/60 bg-cyan/5",
      titleColor: "text-cyan",
      icon: <IconInfo className="h-4 w-4 text-cyan shrink-0" />,
      defaultTitle: "NOTE",
    },
    tip: {
      border: "border-l-4 border-l-success border-line/60 bg-success/5",
      titleColor: "text-success",
      icon: <IconSparkles className="h-4 w-4 text-success shrink-0" />,
      defaultTitle: "PRO TIP",
    },
    warning: {
      border: "border-l-4 border-l-warning border-line/60 bg-warning/5",
      titleColor: "text-warning",
      icon: <IconAlertTriangle className="h-4 w-4 text-warning shrink-0" />,
      defaultTitle: "CAUTION",
    },
    danger: {
      border: "border-l-4 border-l-danger border-line/60 bg-danger/5",
      titleColor: "text-danger",
      icon: <IconFlame className="h-4 w-4 text-danger shrink-0" />,
      defaultTitle: "CRITICAL",
    },
  }[variant];

  return (
    <div
      role="note"
      className={`my-4 rounded-xs border p-4 font-sans text-sm ${config.border} ${className}`}
    >
      <div className="flex items-center gap-2 font-ui font-semibold tracking-wider text-xs uppercase mb-1.5">
        {config.icon}
        <span className={config.titleColor}>{title ?? config.defaultTitle}</span>
      </div>
      <div className="text-ink/90 leading-relaxed pl-6">{children}</div>
    </div>
  );
}

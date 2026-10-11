import type { ReactNode } from "react";
import { IconAlertTriangle, IconRotateCcw } from "./icons";
import { Button } from "./Button";

export function ErrorState({
  title = "SUBSYSTEM ERROR",
  message,
  onRetry,
  retryLabel = "RETRY OPERATION",
  action,
  className = "",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-sm border border-danger/40 bg-danger/5 px-6 py-10 text-center ${className}`}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-danger/40 bg-danger/15 text-danger">
        <IconAlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="font-ui text-sm font-bold tracking-wider uppercase text-danger">
        {title}
      </h3>
      {message && (
        <p className="mt-1.5 max-w-md font-sans text-xs text-muted leading-relaxed">
          {message}
        </p>
      )}
      <div className="mt-5 flex items-center gap-3">
        {onRetry && (
          <Button variant="danger" size="sm" onClick={onRetry}>
            <IconRotateCcw className="h-3.5 w-3.5" />
            <span>{retryLabel}</span>
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

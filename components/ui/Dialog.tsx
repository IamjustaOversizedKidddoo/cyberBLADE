"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconCross } from "./icons";
import { Button } from "./Button";

export function Dialog({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-void/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface */}
      <div
        ref={dialogRef}
        className={`relative w-full ${maxWidth} rounded-sm border border-cyan/40 bg-surface-raised shadow-[0_12px_40px_rgba(0,0,0,0.8)] z-10 animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          {title ? (
            <h2 id="dialog-title" className="font-ui text-sm font-semibold tracking-wider text-ink uppercase">
              {title}
            </h2>
          ) : (
            <div />
          )}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Close dialog"
            onClick={onClose}
            className="text-muted hover:text-ink"
          >
            <IconCross className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { Kbd } from "@/components/ui/Kbd";
import { ModalFocusScope } from "@/components/ui/ModalFocusScope";
import { IconCross } from "@/components/ui/icons";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function KeyboardHelpDialog({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "j", description: "Move selection down in alert queue" },
    { key: "k", description: "Move selection up in alert queue" },
    { key: "Enter", description: "Open selected alert details" },
    { key: "d", description: "Jump focus to triage decision form" },
    { key: "e", description: "Quickly toggle escalation flag" },
    { key: "/", description: "Focus queue search filter" },
    { key: "u", description: "Select next untriaged alert" },
    { key: "?", description: "Toggle this keyboard shortcuts dialog" },
    { key: "Escape", description: "Close dialog or blur input" },
  ];

  return (
    <ModalFocusScope onClose={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-help-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-sm border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 id="kbd-help-title" className="font-mono text-base font-bold text-ink">
            Keyboard Navigation Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs p-1 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Close shortcuts help"
          >
            <IconCross className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          Shortcuts operate in the operator console when not actively typing inside input fields or textareas.
        </p>

        <div className="mt-4 divide-y divide-line/40">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2 text-xs">
              <span className="text-secondary">{s.description}</span>
              <Kbd>{s.key}</Kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs border border-line bg-surface-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
    </ModalFocusScope>
  );
}

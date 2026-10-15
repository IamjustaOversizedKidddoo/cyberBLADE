"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes an `aria-modal` dialog behave like one (L1-A-15): focus moves into it on open, Tab and
 * Shift+Tab stay inside, Escape closes it (when `onClose` is given), and focus returns to the
 * control that opened it. Wrap the dialog element; render the scope only while the dialog is open.
 */
export function ModalFocusScope({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = root.querySelector<HTMLElement>('[role="dialog"]') ?? root;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!dialog.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first) first.focus();
      else {
        if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
        dialog.focus();
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

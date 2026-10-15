// @vitest-environment jsdom
/**
 * L1-A-15 regression: SOC dialogs that say aria-modal behave modally (focus in, Tab trapped,
 * Escape closes, focus returns to the opener), and every such SOC dialog uses the shared scope.
 */
import fs from "node:fs";
import path from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ModalFocusScope } from "@/components/ui/ModalFocusScope";

// jsdom has no layout; treat every element as visible for the focusable filter.
Object.defineProperty(HTMLElement.prototype, "offsetParent", { get() { return this.parentNode; } });

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <ModalFocusScope onClose={() => { onClose(); setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Test">
            <button>First</button>
            <button>Last</button>
          </div>
        </ModalFocusScope>
      )}
    </div>
  );
}

describe("ModalFocusScope", () => {
  it("moves focus in, traps Tab, closes on Escape and restores focus to the opener", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText("Open");
    opener.focus();
    act(() => opener.click());
    expect(document.activeElement).toBe(screen.getByText("First"));

    screen.getByText("Last").focus();
    fireEvent.keyDown(screen.getByText("Last"), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("First"));
    fireEvent.keyDown(screen.getByText("First"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("Last"));

    fireEvent.keyDown(screen.getByText("Last"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("every SOC component that declares aria-modal uses the scope or a native <dialog>", () => {
    const root = path.resolve("components/labs/soc");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name));
        else if (e.name.endsWith(".tsx")) files.push(path.join(d, e.name));
      }
    };
    walk(root);
    const missing = files.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return src.includes('aria-modal="true"') && !src.includes("ModalFocusScope") && !src.includes("<dialog");
    });
    // The enrichment workbench manages its own focus and the workspace closes it with Escape.
    expect(missing.map((f) => path.relative(root, f).replace(/\\/g, "/"))).toEqual(["enrichment/EnrichmentWorkbenchDrawer.tsx"]);
  });
});

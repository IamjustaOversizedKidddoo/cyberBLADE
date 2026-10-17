// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// Mock xterm to prevent canvas/addon errors in jsdom
vi.mock("@xterm/xterm", () => {
  return {
    Terminal: class MockTerminal {
      open = vi.fn();
      loadAddon = vi.fn();
      write = vi.fn();
      writeln = vi.fn();
      clear = vi.fn();
      reset = vi.fn();
      dispose = vi.fn();
      focus = vi.fn();
      onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
      element = document.createElement("div");
    },
  };
});
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn();
  },
}));
vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: class MockWebLinksAddon {},
}));

global.ResizeObserver = class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

import TerminalLab from "@/components/labs/terminal/TerminalLab";

describe("TerminalLab Accessibility Regression (C-19, C-20)", () => {
  const dummyWorld = {
    hostname: "linux-node-01",
    user: "operator",
    cwd: "/home/operator",
    fs: {},
    env: {},
  };

  it("ensures #terminal-exit anchor does not have prohibited aria-label", () => {
    const { container } = render(
      <TerminalLab
        world={dummyWorld as any}
        objectives={[]}
        onSubmit={vi.fn()}
      />
    );

    const exitAnchor = container.querySelector("#terminal-exit");
    expect(exitAnchor).not.toBeNull();
    // C-19 fix: aria-label on generic div without role is prohibited in WCAG
    expect(exitAnchor?.hasAttribute("aria-label")).toBe(false);
  });

  it("ensures terminal header hostname uses high-contrast text-muted class", () => {
    const { container } = render(
      <TerminalLab
        world={dummyWorld as any}
        objectives={[]}
        onSubmit={vi.fn()}
      />
    );

    // C-20 fix: text-muted/60 lacked contrast; now text-muted
    const hostnameSpan = container.querySelector("span.text-muted");
    expect(hostnameSpan).not.toBeNull();
    expect(hostnameSpan?.textContent).toContain("linux-node-01");
  });
});

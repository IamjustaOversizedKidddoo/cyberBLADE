// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { AudioToggle } from "@/components/theme/AudioToggle";
import { setAudioEnabled } from "@/lib/audio/sound-fx";

describe("AudioToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("server-rendered HTML is deterministic and muted by default", () => {
    const html = renderToString(<AudioToggle />);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Enable audio effects"');
    expect(html).toContain("AUDIO: MUTED");
  });

  test("toggles audio state on click and persists to localStorage", () => {
    render(<AudioToggle />);
    const button = screen.getByRole("button", { name: /enable audio effects/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("AUDIO: MUTED")).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /disable audio effects/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("AUDIO: ON")).toBeInTheDocument();
    expect(localStorage.getItem("cyberblade_audio")).toBe("true");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /enable audio effects/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("AUDIO: MUTED")).toBeInTheDocument();
    expect(localStorage.getItem("cyberblade_audio")).toBe("false");
  });

  test("synchronizes when audio state is changed externally via setAudioEnabled", () => {
    render(<AudioToggle />);
    expect(screen.getByRole("button", { name: /enable audio effects/i })).toHaveAttribute("aria-pressed", "false");

    act(() => {
      setAudioEnabled(true);
    });

    expect(screen.getByRole("button", { name: /disable audio effects/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("AUDIO: ON")).toBeInTheDocument();
  });
});

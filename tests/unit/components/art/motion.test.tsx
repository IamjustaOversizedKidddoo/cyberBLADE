// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { buildScene } = vi.hoisted(() => {
  // ScrollTrigger reads matchMedia when it is imported, before beforeEach runs.
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  return { buildScene: vi.fn() };
});
vi.mock("@/lib/art/scene", () => ({ buildScene }));

import { Counter } from "@/components/art/motion/Counter";
import { Magnetic } from "@/components/art/motion/Magnetic";
import { useReducedMotion } from "@/components/art/motion/reduced";
import { Reveal } from "@/components/art/motion/Reveal";
import { ScrollScene } from "@/components/art/motion/ScrollScene";

let systemReduce = false;
beforeEach(() => {
  systemReduce = false;
  delete document.documentElement.dataset.motion;
  window.matchMedia = vi.fn((q: string) => ({
    matches: q.includes("prefers-reduced-motion") ? systemReduce : true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  buildScene.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("useReducedMotion — the system setting OR CYBERBLADE's toggle", () => {
  test("false by default, true when the toggle sets data-motion=reduce later", async () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
      await Promise.resolve();
    });
    expect(result.current).toBe(true);
  });

  test("true when the operating system asks for reduced motion", () => {
    systemReduce = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});

describe("server HTML is the final, readable state", () => {
  test("Reveal renders its children visible", () => {
    const html = renderToString(
      <Reveal mode="clip">
        <p>Briefing</p>
      </Reveal>,
    );
    expect(html).toContain("<p>Briefing</p>");
    expect(html).not.toMatch(/opacity:\s*0|visibility:\s*hidden|clip-path/);
  });

  test("Counter renders the final number, with a text equivalent", () => {
    const html = renderToString(<Counter to={1234} />);
    expect(html).toContain("1234");
    render(<Counter to={99999} format={(n) => n.toLocaleString("en-IN")} />);
    expect(screen.getAllByText("99,999").length).toBeGreaterThan(0);
  });
});

test("Magnetic leaves the child's keyboard behaviour alone", () => {
  render(
    <Magnetic>
      <a href="/start">Start</a>
    </Magnetic>,
  );
  const link = screen.getByRole("link", { name: "Start" });
  expect(link.getAttribute("tabindex")).toBeNull();
  expect(link.parentElement?.getAttribute("tabindex")).toBeNull();
});

describe("ScrollScene", () => {
  test("renders its children", () => {
    render(
      <ScrollScene pin steps={4}>
        <h2>breaking into the system</h2>
      </ScrollScene>,
    );
    expect(screen.getByRole("heading", { name: "breaking into the system" })).toBeInTheDocument();
  });

  test("with motion allowed on a wide screen it builds exactly one pinned desktop scene", () => {
    render(
      <ScrollScene pin length={3}>
        <p>scene</p>
      </ScrollScene>,
    );
    expect(buildScene).toHaveBeenCalledTimes(1);
    expect(buildScene.mock.calls[0][2]).toMatchObject({ desktop: true, pin: true, length: 3 });
  });

  test("with reduced motion it builds nothing at all", () => {
    document.documentElement.dataset.motion = "reduce";
    render(
      <ScrollScene pin>
        <p>scene</p>
      </ScrollScene>,
    );
    expect(buildScene).not.toHaveBeenCalled();
  });

  test("on a phone, mobile=play builds the play-once version and static builds nothing", () => {
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia;
    const { unmount } = render(
      <ScrollScene pin mobile="play">
        <p>scene</p>
      </ScrollScene>,
    );
    expect(buildScene).toHaveBeenCalledTimes(1);
    expect(buildScene.mock.calls[0][2]).toMatchObject({ desktop: false, pin: false });
    unmount();
    buildScene.mockClear();
    render(
      <ScrollScene pin>
        <p>scene</p>
      </ScrollScene>,
    );
    expect(buildScene).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const { Lenis } = vi.hoisted(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const Lenis = vi.fn(function (this: Record<string, unknown>) {
    this.on = vi.fn();
    this.raf = vi.fn();
    this.destroy = vi.fn();
  });
  return { Lenis };
});
vi.mock("lenis", () => ({ default: Lenis }));

import { SmoothScroll } from "@/components/art/motion/SmoothScroll";

let env = { reduce: false, coarse: false, wide: true };
beforeEach(() => {
  env = { reduce: false, coarse: false, wide: true };
  delete document.documentElement.dataset.motion;
  Lenis.mockClear();
  window.matchMedia = vi.fn((q: string) => ({
    matches: q.includes("reduced-motion") ? env.reduce : q.includes("coarse") ? env.coarse : q.includes("min-width") ? env.wide : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

test("starts smooth scrolling on a wide screen with a mouse and motion allowed, and cleans up", () => {
  const { unmount } = render(<SmoothScroll />);
  expect(Lenis).toHaveBeenCalledTimes(1);
  const instance = Lenis.mock.instances[0] as unknown as { destroy: ReturnType<typeof vi.fn> };
  unmount();
  expect(instance.destroy).toHaveBeenCalled();
});

test.each([
  ["reduced motion (system)", () => (env.reduce = true)],
  ["reduced motion (toggle)", () => (document.documentElement.dataset.motion = "reduce")],
  ["a touch screen", () => (env.coarse = true)],
  ["a narrow screen", () => (env.wide = false)],
])("never starts with %s", (_, setup) => {
  setup();
  render(<SmoothScroll />);
  expect(Lenis).not.toHaveBeenCalled();
});

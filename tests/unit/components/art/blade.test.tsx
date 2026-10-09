// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const { loadThree } = vi.hoisted(() => ({ loadThree: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/components/art/motion/three-loader", async (orig) => ({ ...(await orig<object>()), loadThree }));

import { BladeObject } from "@/components/art/motion/BladeObject";
import { canRunBlade } from "@/components/art/motion/three-loader";

let env = { reduce: false, coarse: false, width: 1440, webgl2: true };
beforeEach(() => {
  env = { reduce: false, coarse: false, width: 1440, webgl2: true };
  delete document.documentElement.dataset.motion;
  loadThree.mockClear();
  window.matchMedia = vi.fn((q: string) => {
    const min = Number(q.match(/min-width:\s*(\d+)/)?.[1] ?? 0);
    const matches = q.includes("reduced-motion") ? env.reduce : q.includes("pointer: fine") ? !env.coarse : q.includes("min-width") ? env.width >= min : false;
    return { matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  }) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = vi.fn((kind: string) => (kind === "webgl2" && env.webgl2 ? ({} as never) : null)) as never;
  window.requestIdleCallback = ((cb: () => void) => (cb(), 1)) as unknown as typeof window.requestIdleCallback;
  window.cancelIdleCallback = vi.fn();
});

test("capable desktop with motion allowed: three.js is requested once the page is idle", () => {
  expect(canRunBlade()).toBe(true);
  render(<BladeObject />);
  expect(loadThree).toHaveBeenCalledTimes(1);
});

test.each([
  ["reduced motion", () => (env.reduce = true)],
  ["the reduce-motion toggle", () => (document.documentElement.dataset.motion = "reduce")],
  ["a phone-width window", () => (env.width = 800)],
  ["a touch screen", () => (env.coarse = true)],
  ["no WebGL2", () => (env.webgl2 = false)],
])("never downloads three.js with %s — the drawn blade stays", (_, setup) => {
  setup();
  const { container } = render(<BladeObject />);
  expect(loadThree).not.toHaveBeenCalled();
  expect(container.querySelector("svg")).not.toBeNull();
});

test("the whole object is decorative", () => {
  const { container } = render(<BladeObject />);
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
});

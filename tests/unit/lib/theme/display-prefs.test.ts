// @vitest-environment jsdom
import { applyPrefs, readPrefs } from "@/lib/theme/display-prefs";

const store = (v: string | null) => ({ getItem: () => v });

test("OS reduced motion applies when nothing stored", () => {
  expect(readPrefs(store(null), true)).toEqual({ motion: "reduce", contrast: "normal" });
});

test("stored choice beats OS", () => {
  expect(readPrefs(store('{"motion":"full","contrast":"high"}'), true)).toEqual({ motion: "full", contrast: "high" });
});

test("corrupt storage falls back to defaults", () => {
  expect(readPrefs(store("{oops"), false)).toEqual({ motion: "full", contrast: "normal" });
});

test("unknown stored values are ignored", () => {
  expect(readPrefs(store('{"motion":"wild","contrast":5}'), false)).toEqual({ motion: "full", contrast: "normal" });
});

test("storage that throws (private mode) falls back to defaults", () => {
  const throwing = { getItem: () => { throw new Error("denied"); } };
  expect(readPrefs(throwing, true)).toEqual({ motion: "reduce", contrast: "normal" });
});

test("applyPrefs sets data attributes on the root", () => {
  const root = document.createElement("html");
  applyPrefs(root, { motion: "reduce", contrast: "high" });
  expect(root.dataset.motion).toBe("reduce");
  expect(root.dataset.contrast).toBe("high");
});

describe("PREFS_BOOT_SCRIPT", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.motion;
    delete document.documentElement.dataset.contrast;
  });

  const run = async (osReduce: boolean) => {
    const { PREFS_BOOT_SCRIPT } = await import("@/lib/theme/display-prefs");
    window.matchMedia = ((q: string) => ({ matches: osReduce && q.includes("reduce") })) as typeof window.matchMedia;
    // Run in a fresh scope with no access to module variables, exactly like an inline <script>.
    new Function(PREFS_BOOT_SCRIPT)();
  };

  test("applies stored prefs standalone", async () => {
    localStorage.setItem("neon.display", '{"motion":"reduce","contrast":"high"}');
    await run(false);
    expect(document.documentElement.dataset).toMatchObject({ motion: "reduce", contrast: "high" });
  });

  test("follows OS reduced motion when nothing stored", async () => {
    await run(true);
    expect(document.documentElement.dataset.motion).toBe("reduce");
  });

  describe("keeps following the OS setting live, until the operator makes a choice", () => {
    let listeners: ((e: { matches: boolean }) => void)[] = [];
    const runLive = async (osReduce: boolean) => {
      listeners = [];
      const { PREFS_BOOT_SCRIPT } = await import("@/lib/theme/display-prefs");
      window.matchMedia = ((q: string) => ({
        matches: osReduce && q.includes("reduce"),
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
      })) as unknown as typeof window.matchMedia;
      new Function(PREFS_BOOT_SCRIPT)();
    };

    test("the OS turns reduced motion off and on again while the page is open", async () => {
      await runLive(true);
      expect(document.documentElement.dataset.motion).toBe("reduce");
      listeners.forEach((fn) => fn({ matches: false }));
      expect(document.documentElement.dataset.motion).toBe("full");
      listeners.forEach((fn) => fn({ matches: true }));
      expect(document.documentElement.dataset.motion).toBe("reduce");
    });

    test("a choice the operator saved is never overridden by the OS", async () => {
      await runLive(false);
      localStorage.setItem("neon.display", '{"motion":"full","contrast":"normal"}');
      listeners.forEach((fn) => fn({ matches: true }));
      expect(document.documentElement.dataset.motion).toBe("full");
    });
  });
});

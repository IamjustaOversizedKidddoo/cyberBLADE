// @vitest-environment jsdom
import { buildScene, interpolatePath, parseVars, type GsapLike } from "@/lib/art/scene";

test("parseVars keeps only cheap, known properties and ignores bad JSON", () => {
  expect(parseVars('{"scale":6,"opacity":0,"filter":"blur(8px)","rotate":-4}')).toEqual({ scale: 6, opacity: 0, rotate: -4 });
  expect(parseVars("{not json")).toBeNull();
  expect(parseVars(undefined)).toBeNull();
  expect(parseVars('{"onComplete":"alert(1)","x":"-20%"}')).toEqual({ x: "-20%" });
});

test("interpolatePath walks the earlier positions to the final one", () => {
  const path = [{ x: 0, y: 0 }, { x: 50, y: 0 }];
  const final = { x: 50, y: 100 };
  expect(interpolatePath(path, final, 0)).toEqual({ x: 0, y: 0 });
  expect(interpolatePath(path, final, 0.25)).toEqual({ x: 25, y: 0 });
  expect(interpolatePath(path, final, 0.5)).toEqual({ x: 50, y: 0 });
  expect(interpolatePath(path, final, 1)).toEqual({ x: 50, y: 100 });
  expect(interpolatePath([], final, 0.3)).toEqual(final);
});

function fakeGsap() {
  const calls: { method: string; targets: unknown; vars: Record<string, unknown>; at: number | undefined }[] = [];
  let created: Record<string, unknown> | null = null;
  let scale = 1;
  const tl = {
    from: (targets: unknown, vars: Record<string, unknown>, at?: number) => (calls.push({ method: "from", targets, vars, at }), tl),
    to: (targets: unknown, vars: Record<string, unknown>, at?: number) => (calls.push({ method: "to", targets, vars, at }), tl),
    set: (targets: unknown, vars: Record<string, unknown>, at?: number) => (calls.push({ method: "set", targets, vars, at }), tl),
    timeScale: (n: number) => ((scale = n), tl),
  };
  const api: GsapLike = {
    timeline: (vars) => {
      created = vars as Record<string, unknown>;
      return tl;
    },
  };
  return { api, calls, created: () => created, scale: () => scale };
}

function scene(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

test("desktop: one pinned, scrubbed timeline; camera, element, kinetic-type and morph tweens at their fractions", () => {
  const root = scene(`
    <div data-camera='{"scale":6,"rotate":-4}' data-dur="0.6"></div>
    <p data-from='{"opacity":0,"y":40}' data-at="0.5" data-dur="0.2">copy</p>
    <h1 data-chars='{"yPercent":120,"stagger":0.04}' data-at="0.1"><span data-char="0">C</span><span data-char="1">B</span></h1>
    <div class="diagram"><svg><path data-link-from="a" data-link-to="b" data-shape="straight"></path></svg>
      <span class="diagram-node" data-node-id="a" data-morph='[{"x":0,"y":0}]' style="left:50%;top:50%"></span>
      <span class="diagram-node" data-node-id="b" style="left:90%;top:50%"></span></div>`);
  const g = fakeGsap();
  buildScene(g.api, root, { desktop: true, pin: true, scrub: true, length: 3, onProgress: () => {} });
  expect(g.created()).toMatchObject({ scrollTrigger: { pin: true, scrub: true, start: "top top", end: "+=300%" } });
  const [camera, copy, chars, morph] = g.calls.filter((c) => c.method !== "set");
  expect(camera).toMatchObject({ method: "from", vars: { scale: 6, rotate: -4, duration: 0.6 }, at: 0 });
  expect(copy).toMatchObject({ method: "from", vars: { opacity: 0, y: 40, duration: 0.2 }, at: 0.5 });
  expect(chars).toMatchObject({ method: "from", vars: { yPercent: 120, stagger: 0.04 }, at: 0.1 });
  expect((chars.targets as NodeList).length).toBe(2);
  expect(morph.method).toBe("to");
  // the timeline is padded to exactly 1 so fractions map onto the scroll distance
  expect(g.calls.some((c) => c.method === "set" && c.at === 1)).toBe(true);
});

test("out-of-range fractions are clamped", () => {
  const root = scene(`<p data-from='{"opacity":0}' data-at="7" data-dur="-2">x</p>`);
  const g = fakeGsap();
  buildScene(g.api, root, { desktop: true, pin: false, scrub: true, length: 2, onProgress: () => {} });
  const tween = g.calls.find((c) => c.method === "from")!;
  expect(tween.at).toBe(1);
  expect(tween.vars.duration).toBe(0);
});

test("phones: the same timeline plays once on arrival, faster, without pinning or scrubbing", () => {
  const root = scene(`<p data-from='{"opacity":0}'>x</p>`);
  const g = fakeGsap();
  buildScene(g.api, root, { desktop: false, pin: true, scrub: true, length: 3, onProgress: () => {} });
  expect(g.created()).toMatchObject({ scrollTrigger: { start: "top 80%", toggleActions: "play none none none" } });
  expect((g.created()!.scrollTrigger as Record<string, unknown>).pin).toBeUndefined();
  expect(g.scale()).toBe(2.5);
});

test("the morph tween moves nodes and redraws the links between them", () => {
  const root = scene(`<div class="diagram"><svg><path data-link-from="a" data-link-to="b" data-shape="straight" d=""></path></svg>
    <span class="diagram-node" data-node-id="a" data-morph='[{"x":0,"y":0}]' style="left:50%;top:50%"></span>
    <span class="diagram-node" data-node-id="b" style="left:90%;top:50%"></span></div>`);
  const g = fakeGsap();
  buildScene(g.api, root, { desktop: true, pin: false, scrub: true, length: 2, onProgress: () => {} });
  const morph = g.calls.find((c) => c.method === "to")!;
  const proxy = morph.targets as { p: number };
  proxy.p = 0;
  (morph.vars.onUpdate as () => void)();
  const a = root.querySelector('[data-node-id="a"]') as HTMLElement;
  expect(a.style.left).toBe("0%");
  expect(root.querySelector("path")!.getAttribute("d")).toBe("M 0 0 L 90 50");
  proxy.p = 1;
  (morph.vars.onUpdate as () => void)();
  expect(a.style.left).toBe("50%");
  expect(root.querySelector("path")!.getAttribute("d")).toBe("M 50 50 L 90 50");
});

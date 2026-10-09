import { linkPath, type DiagramLink, type Point } from "./diagram";

/**
 * CYBERBLADE's scene language (spec 2026-10-08 cinematic §3.1). Markup inside a ScrollScene is
 * server-rendered in its FINAL state and declares where things start:
 *
 *   data-camera='{...}'  the stage's start (dolly/zoom/orbit/tilt) — animates to its natural state
 *   data-from='{...}'    an element's start values
 *   data-chars='{...}'   per-character start values (+ stagger) for a split PosterHeading
 *   data-morph='[{x,y}]' a diagram node's earlier positions (%), interpolated to its final x/y
 *   data-at / data-dur   when, and for how long, as fractions (0–1) of the scene
 *
 * buildScene turns that into ONE timeline of length 1 so fractions map straight onto scroll.
 * GSAP is passed in, which keeps this file free of the library and fully testable.
 */

export type TweenVars = Record<string, number | string>;

// Only properties that animate on the compositor (or are cheap) — never filters, never callbacks.
const ALLOWED = new Set(["opacity", "x", "y", "xPercent", "yPercent", "z", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "skewX", "clipPath", "stagger"]);

export function parseVars(json: string | null | undefined): TweenVars | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: TweenVars = {};
  for (const [k, v] of Object.entries(raw)) if (ALLOWED.has(k) && (typeof v === "number" || typeof v === "string")) out[k] = v;
  return out;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const fraction = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value === undefined || Number.isNaN(n) ? fallback : clamp01(n);
};

function parsePoints(json: string | undefined): Point[] {
  try {
    const raw = JSON.parse(json ?? "[]");
    return Array.isArray(raw) ? raw.filter((p) => typeof p?.x === "number" && typeof p?.y === "number") : [];
  } catch {
    return [];
  }
}

/** Position along earlier positions → final, with p in 0–1 split evenly across the segments. */
export function interpolatePath(path: Point[], final: Point, p: number): Point {
  const pts = [...path, final];
  if (pts.length === 1) return final;
  const t = clamp01(p) * (pts.length - 1);
  const i = Math.min(Math.floor(t), pts.length - 2);
  const k = t - i;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(pts[i].x + (pts[i + 1].x - pts[i].x) * k), y: r(pts[i].y + (pts[i + 1].y - pts[i].y) * k) };
}

type Tl = {
  from(targets: unknown, vars: Record<string, unknown>, position?: number): Tl;
  to(targets: unknown, vars: Record<string, unknown>, position?: number): Tl;
  set(targets: unknown, vars: Record<string, unknown>, position?: number): Tl;
  timeScale(n: number): Tl;
};
export type GsapLike = { timeline(vars: Record<string, unknown>): Tl };

export type SceneOptions = {
  /** Wide screen with motion allowed: pinned/scrubbed. Otherwise the phone version (plays once). */
  desktop: boolean;
  pin: boolean;
  scrub: boolean | number;
  /** Scroll distance of a pinned scene, in viewport heights. */
  length: number;
  onProgress(progress: number): void;
};

const pct = (v: string) => Number.parseFloat(v) || 0;

/** One proxy tween per morphing diagram: moves its nodes and redraws every link from their positions. */
function morphDiagram(tl: Tl, diagram: Element, at: number, dur: number) {
  const nodes = [...diagram.querySelectorAll<HTMLElement>(".diagram-node")].map((el) => ({
    el,
    id: el.dataset.nodeId ?? "",
    path: parsePoints(el.dataset.morph),
    final: { x: pct(el.style.left), y: pct(el.style.top) },
  }));
  const links = [...diagram.querySelectorAll<SVGPathElement>("path[data-link-from][data-link-to]")];
  const proxy = { p: 1 };
  const update = () => {
    const pos = new Map<string, Point>();
    for (const n of nodes) {
      const at = interpolatePath(n.path, n.final, proxy.p);
      pos.set(n.id, at);
      if (n.path.length) {
        n.el.style.left = `${at.x}%`;
        n.el.style.top = `${at.y}%`;
      }
    }
    for (const l of links) {
      const a = pos.get(l.dataset.linkFrom ?? "");
      const b = pos.get(l.dataset.linkTo ?? "");
      if (a && b) l.setAttribute("d", linkPath(a, b, (l.dataset.shape as DiagramLink["shape"]) ?? "straight"));
    }
  };
  tl.to(proxy, { p: 1, startAt: { p: 0 }, duration: dur, onUpdate: update }, at);
}

export function buildScene(gsap: GsapLike, root: Element, o: SceneOptions): Tl {
  const scrollTrigger = o.desktop
    ? {
        trigger: root,
        pin: o.pin,
        scrub: o.scrub,
        start: o.pin ? "top top" : "top 85%",
        end: o.pin ? `+=${Math.round(o.length * 100)}%` : "bottom 25%",
        onUpdate: (self: { progress: number }) => o.onProgress(self.progress),
      }
    : { trigger: root, start: "top 80%", toggleActions: "play none none none" };
  const tl = gsap.timeline({ defaults: { ease: o.desktop ? "none" : "power2.out" }, scrollTrigger });

  for (const el of root.querySelectorAll<HTMLElement>("[data-camera], [data-from], [data-chars]")) {
    const at = fraction(el.dataset.at, 0);
    const dur = fraction(el.dataset.dur, el.dataset.camera !== undefined ? 1 : 0.25);
    if (el.dataset.camera !== undefined) {
      const vars = parseVars(el.dataset.camera);
      if (vars) {
        if (!o.desktop) {
          delete vars.rotate;
          delete vars.rotateX;
          delete vars.rotateY;
        }
        tl.from(el, { ...vars, duration: dur }, at);
      }
    }
    if (el.dataset.from !== undefined) {
      const vars = parseVars(el.dataset.from);
      if (vars) {
        if (!o.desktop) {
          delete vars.rotate;
          delete vars.rotateX;
          delete vars.rotateY;
        }
        tl.from(el, { ...vars, duration: dur }, at);
      }
    }
    if (el.dataset.chars !== undefined) {
      const vars = parseVars(el.dataset.chars);
      const chars = el.querySelectorAll("[data-char]");
      if (vars && chars.length) tl.from(chars, { ...vars, duration: dur }, at);
    }
  }

  for (const diagram of root.querySelectorAll(".diagram")) {
    if (!diagram.querySelector("[data-morph]")) continue;
    const host = diagram.closest<HTMLElement>("[data-morph-at]");
    morphDiagram(tl, diagram, fraction(host?.dataset.morphAt, 0), fraction(host?.dataset.morphDur, 0.6));
  }

  tl.set({}, {}, 1); // pad to exactly 1
  if (!o.desktop) tl.timeScale(2.5);
  return tl;
}

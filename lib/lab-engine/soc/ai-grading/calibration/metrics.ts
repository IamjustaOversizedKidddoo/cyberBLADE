/**
 * Agreement metrics for calibrating AI bands (0..3) against human graders.
 * Every function is pure and covered by known-answer tests.
 */
import { createRng } from "@/lib/generators/rng";

export const K = 4; // bands 0..3

/** Quadratic-weighted Cohen's kappa for two raters on categories 0..k-1. Null when undefined (no variation). */
export function quadraticWeightedKappa(a: number[], b: number[], k = K): number | null {
  if (a.length !== b.length) throw new Error("rating arrays differ in length");
  const n = a.length;
  if (n === 0) return null;
  const O = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const ra = new Array<number>(k).fill(0);
  const rb = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    O[a[i]][b[i]]++;
    ra[a[i]]++;
    rb[b[i]]++;
  }
  let num = 0;
  let den = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = (i - j) ** 2 / (k - 1) ** 2;
      num += w * O[i][j];
      den += (w * ra[i] * rb[j]) / n;
    }
  }
  return den === 0 ? null : 1 - num / den;
}

export type AlphaMetric = "nominal" | "ordinal" | "interval";

/**
 * Krippendorff's alpha. `units` = per-unit values from any number of coders (missing omitted).
 * Units with fewer than two values are not pairable and are ignored. Null when undefined.
 */
export function krippendorffAlpha(units: number[][], metric: AlphaMetric = "ordinal"): number | null {
  const pairable = units.filter((u) => u.length >= 2);
  const values = [...new Set(pairable.flat())].sort((x, y) => x - y);
  if (values.length === 0) return null;
  const idx = new Map(values.map((v, i) => [v, i]));
  const V = values.length;
  const o = Array.from({ length: V }, () => new Array<number>(V).fill(0));
  for (const u of pairable) {
    const m = u.length;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        if (i !== j) o[idx.get(u[i])!][idx.get(u[j])!] += 1 / (m - 1);
      }
    }
  }
  const nc = o.map((row) => row.reduce((s, x) => s + x, 0));
  const n = nc.reduce((s, x) => s + x, 0);
  if (n <= 1) return null;

  const delta2 = (c: number, k: number): number => {
    if (metric === "nominal") return c === k ? 0 : 1;
    if (metric === "interval") return (values[c] - values[k]) ** 2;
    const [lo, hi] = c <= k ? [c, k] : [k, c];
    let sum = 0;
    for (let g = lo; g <= hi; g++) sum += nc[g];
    return (sum - (nc[lo] + nc[hi]) / 2) ** 2;
  };

  let Do = 0;
  let De = 0;
  for (let c = 0; c < V; c++) {
    for (let k = 0; k < V; k++) {
      const d = delta2(c, k);
      Do += o[c][k] * d;
      De += nc[c] * nc[k] * d;
    }
  }
  Do /= n;
  De /= n * (n - 1);
  return De === 0 ? null : 1 - Do / De;
}

/** ICC(2,1): two-way random effects, absolute agreement, single rater (Shrout & Fleiss 1979). Rows = subjects, cols = raters, no missing. */
export function icc21(matrix: number[][]): number | null {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0].length;
  if (k < 2 || matrix.some((r) => r.length !== k)) throw new Error("ICC needs a complete subjects x raters matrix");
  const grand = matrix.flat().reduce((s, x) => s + x, 0) / (n * k);
  const rowMeans = matrix.map((r) => r.reduce((s, x) => s + x, 0) / k);
  const colMeans = Array.from({ length: k }, (_, j) => matrix.reduce((s, r) => s + r[j], 0) / n);
  const ssr = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssc = n * colMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const sst = matrix.flat().reduce((s, x) => s + (x - grand) ** 2, 0);
  const sse = sst - ssr - ssc;
  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));
  const den = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  return den === 0 ? null : (msr - mse) / den;
}

export function meanAbsoluteError(model: number[], human: number[]): number {
  return model.reduce((s, m, i) => s + Math.abs(m - human[i]), 0) / Math.max(1, model.length);
}

export function withinOneBandRate(model: number[], human: number[]): number {
  return model.filter((m, i) => Math.abs(m - human[i]) <= 1).length / Math.max(1, model.length);
}

/** Mean of (model − human): positive = model grades more generously. */
export function signedBias(model: number[], human: number[]): number {
  return model.reduce((s, m, i) => s + (m - human[i]), 0) / Math.max(1, model.length);
}

/** Test–retest: share of items whose band changed between two runs of the same model. */
export function bandFlipRate(run1: number[], run2: number[]): number {
  return run1.filter((b, i) => b !== run2[i]).length / Math.max(1, run1.length);
}

/** Median of several human bands for one item (lower median on ties, like the AI aggregation). */
export function consensusBand(bands: number[]): number {
  const s = [...bands].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
}

export interface ConfidenceInterval {
  estimate: number | null;
  low: number | null;
  high: number | null;
}

/** Seeded percentile bootstrap over items (deterministic for a given seed). */
export function bootstrapCI<T>(items: T[], statistic: (sample: T[]) => number | null, opts: { iterations?: number; seed?: string; level?: number } = {}): ConfidenceInterval {
  const estimate = items.length ? statistic(items) : null;
  if (items.length < 2) return { estimate, low: null, high: null };
  const rng = createRng(opts.seed ?? "bootstrap");
  const B = opts.iterations ?? 1000;
  const stats: number[] = [];
  for (let b = 0; b < B; b++) {
    const sample = Array.from({ length: items.length }, () => items[rng.int(0, items.length - 1)]);
    const v = statistic(sample);
    if (v !== null && Number.isFinite(v)) stats.push(v);
  }
  if (stats.length === 0) return { estimate, low: null, high: null };
  stats.sort((x, y) => x - y);
  const alpha = (1 - (opts.level ?? 0.95)) / 2;
  const at = (q: number) => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(q * (stats.length - 1))))];
  return { estimate, low: at(alpha), high: at(1 - alpha) };
}

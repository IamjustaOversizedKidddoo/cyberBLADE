import { describe, expect, it } from "vitest";
import {
  bandFlipRate,
  bootstrapCI,
  consensusBand,
  icc21,
  krippendorffAlpha,
  meanAbsoluteError,
  quadraticWeightedKappa,
  signedBias,
  withinOneBandRate,
} from "@/lib/lab-engine/soc/ai-grading/calibration/metrics";

describe("quadratic-weighted kappa (known answers)", () => {
  it("is 1 for perfect agreement", () => {
    expect(quadraticWeightedKappa([0, 1, 2, 3, 3], [0, 1, 2, 3, 3])).toBeCloseTo(1, 12);
  });

  it("matches a hand computation: [0,1,2,3] vs [0,1,2,2] = 1 - (1/9)/(8/9) = 0.875", () => {
    // Observed weighted disagreement: only (3,2), w=(3-2)^2/9 = 1/9.
    // Expected: rows uniform; column marginals b=[1,1,2,0]; sum_j c_j*sum_i (i-j)^2 = 14+6+2*6 = 32; /9/4 = 8/9.
    expect(quadraticWeightedKappa([0, 1, 2, 3], [0, 1, 2, 2])).toBeCloseTo(0.875, 12);
  });

  it("is -1 for a full reversal of a uniform scale", () => {
    // Observed: (9+1+1+9)/9 = 20/9; expected: sum over 4x4 of (i-j)^2 = 40, /9/4 = 10/9.
    expect(quadraticWeightedKappa([0, 1, 2, 3], [3, 2, 1, 0])).toBeCloseTo(-1, 12);
  });

  it("is undefined (null) when neither rater varies", () => {
    expect(quadraticWeightedKappa([2, 2, 2], [2, 2, 2])).toBeNull();
  });
});

describe("Krippendorff's alpha (known answers)", () => {
  it("matches a hand computation on a 3-unit, 2-coder example (4/9 for every metric with two values)", () => {
    // Coincidences: o11=2, o22=2, o12=o21=1; n1=n2=3, n=6.
    // Do = (1/6)*2*d, De = (1/30)*2*9*d  ->  alpha = 1 - (1/3)/(3/5) = 4/9.
    const units = [[1, 1], [2, 2], [1, 2]];
    for (const m of ["nominal", "ordinal", "interval"] as const) expect(krippendorffAlpha(units, m)).toBeCloseTo(4 / 9, 12);
  });

  it("reproduces Krippendorff's (2011) worked example with missing data", () => {
    // Four observers, 12 units, values 1..5, '-' = missing (Computing Krippendorff's Alpha-Reliability, 2011).
    const A = [1, 2, 3, 3, 2, 1, 4, 1, 2, null, null, null];
    const B = [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, null, 3];
    const C = [null, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, null];
    const D = [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, null];
    const units = A.map((_, i) => [A[i], B[i], C[i], D[i]].filter((v): v is number => v !== null));
    expect(krippendorffAlpha(units, "nominal")).toBeCloseTo(0.743, 3);
    expect(krippendorffAlpha(units, "interval")).toBeCloseTo(0.849, 3);
    expect(krippendorffAlpha(units, "ordinal")).toBeCloseTo(0.815, 3);
  });

  it("is 1 for perfect agreement with variation, and null without pairable units", () => {
    expect(krippendorffAlpha([[0, 0, 0], [3, 3], [1, 1]], "ordinal")).toBeCloseTo(1, 12);
    expect(krippendorffAlpha([[2], [1]], "ordinal")).toBeNull();
  });
});

describe("ICC(2,1) (known answer)", () => {
  it("reproduces Shrout & Fleiss (1979): six targets, four judges, ICC(2,1) = 0.29", () => {
    const m = [
      [9, 2, 5, 8],
      [6, 1, 3, 2],
      [8, 4, 6, 8],
      [7, 1, 2, 6],
      [10, 5, 6, 9],
      [6, 2, 4, 7],
    ];
    expect(icc21(m)).toBeCloseTo(0.29, 2);
  });

  it("is 1 when raters agree exactly", () => {
    expect(icc21([[0, 0], [1, 1], [3, 3]])).toBeCloseTo(1, 12);
  });
});

describe("simple metrics", () => {
  const model = [0, 1, 3, 2, 2];
  const human = [0, 2, 1, 2, 3];
  it("MAE, within-one, signed bias", () => {
    expect(meanAbsoluteError(model, human)).toBeCloseTo((0 + 1 + 2 + 0 + 1) / 5, 12);
    expect(withinOneBandRate(model, human)).toBeCloseTo(4 / 5, 12);
    expect(signedBias(model, human)).toBeCloseTo((0 - 1 + 2 + 0 - 1) / 5, 12);
  });
  it("band-flip rate and consensus", () => {
    expect(bandFlipRate([1, 2, 3, 0], [1, 3, 3, 1])).toBe(0.5);
    expect(consensusBand([3, 1, 2])).toBe(2);
    expect(consensusBand([1, 2])).toBe(1);
  });
});

describe("bootstrap CI", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ m: i % 4, h: (i + (i % 3 === 0 ? 1 : 0)) % 4 }));
  const stat = (s: typeof items) => quadraticWeightedKappa(s.map((x) => x.m), s.map((x) => x.h));
  it("is deterministic for a seed and brackets the estimate", () => {
    const a = bootstrapCI(items, stat, { seed: "s1", iterations: 500 });
    const b = bootstrapCI(items, stat, { seed: "s1", iterations: 500 });
    expect(a).toEqual(b);
    expect(a.low!).toBeLessThanOrEqual(a.estimate!);
    expect(a.high!).toBeGreaterThanOrEqual(a.estimate!);
  });
  it("returns no interval for fewer than two items", () => {
    expect(bootstrapCI([items[0]], stat)).toMatchObject({ low: null, high: null });
  });
});

import { describe, it, expect } from "vitest";

// WCAG relative luminance calculation
function sRGBtoLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = relativeLuminance(hex1);
  const lum2 = relativeLuminance(hex2);
  const bright = Math.max(lum1, lum2);
  const dark = Math.min(lum1, lum2);
  return (bright + 0.05) / (dark + 0.05);
}

describe("Theme Token Contrast Regression Protection (WCAG 2.2 AA)", () => {
  const TOKENS = {
    void: "#000000",
    ink: "#ffffff",
    muted: "#9cb0c4",
    cyan: "#0fbeff",
    purple: "#d864ff",
    console: "#05070a",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    paperBg: "#f5fafc",
    paperInk: "#0a0f18",
    paperMuted: "#334155",
    paperCyan: "#0369a1",
  };

  it("ink on void exceeds 7:1 (WCAG AAA)", () => {
    const ratio = contrastRatio(TOKENS.ink, TOKENS.void);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it("muted on void exceeds 4.5:1 (WCAG AA normal text)", () => {
    const ratio = contrastRatio(TOKENS.muted, TOKENS.void);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("cyan accent on console background exceeds 4.5:1 (WCAG AA)", () => {
    const ratio = contrastRatio(TOKENS.cyan, TOKENS.console);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("purple accent on console background exceeds 4.5:1 (WCAG AA)", () => {
    const ratio = contrastRatio(TOKENS.purple, TOKENS.console);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("light paper band overrides satisfy WCAG 2.2 AA", () => {
    const inkOnPaper = contrastRatio(TOKENS.paperInk, TOKENS.paperBg);
    expect(inkOnPaper).toBeGreaterThanOrEqual(7.0);

    const mutedOnPaper = contrastRatio(TOKENS.paperMuted, TOKENS.paperBg);
    expect(mutedOnPaper).toBeGreaterThanOrEqual(4.5);

    const cyanOnPaper = contrastRatio(TOKENS.paperCyan, TOKENS.paperBg);
    expect(cyanOnPaper).toBeGreaterThanOrEqual(4.5);
  });

  it("interactive UI indicators exceed 3:1 (WCAG Non-text Contrast)", () => {
    const cyanOnVoid = contrastRatio(TOKENS.cyan, TOKENS.void);
    expect(cyanOnVoid).toBeGreaterThanOrEqual(3.0);

    const warningOnVoid = contrastRatio(TOKENS.warning, TOKENS.void);
    expect(warningOnVoid).toBeGreaterThanOrEqual(3.0);

    const dangerOnVoid = contrastRatio(TOKENS.danger, TOKENS.void);
    expect(dangerOnVoid).toBeGreaterThanOrEqual(3.0);
  });
});

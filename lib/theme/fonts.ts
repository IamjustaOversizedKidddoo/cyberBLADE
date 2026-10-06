import localFont from "next/font/local";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

// Display headings + wordmark only (CLAUDE.md theme rules).
export const hacked = localFont({
  src: "../../public/fonts/Hacked.ttf",
  variable: "--font-hacked",
  display: "swap",
});

// Subheadings, buttons, labels, nav.
export const pixel = localFont({
  src: [
    { path: "../../public/fonts/PixelOperator.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/PixelOperator-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-pixel",
  display: "swap",
});

// Lesson prose, form labels, help and error text.
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

// Terminals and code.
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const fontVariables = [hacked, pixel, plexSans, jetbrainsMono].map((f) => f.variable).join(" ");

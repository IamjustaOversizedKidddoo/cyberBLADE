import type { Metadata } from "next";
import { TerminalPanel } from "@/components/theme/TerminalPanel";

export const metadata: Metadata = { title: "Credits" };

export default function CreditsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-5xl">credits_</h1>
      <TerminalPanel title="fonts">
        <h3 className="text-xl">Hacked</h3>
        <p className="mb-6 text-muted">
          By David Libeau —{" "}
          <a href="https://hackedfont.com" className="text-cyan underline">
            hackedfont.com
          </a>
          . Licensed under Creative Commons Attribution (CC-BY).
        </p>
        <h3 className="text-xl">Pixel Operator</h3>
        <p className="text-muted">By Jayvee Enaguas (HarvettFox96). Released under Creative Commons Zero (CC0) 1.0.</p>
      </TerminalPanel>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { EthicalUseAgreement } from "@/components/legal/EthicalUseAgreement";

export const metadata: Metadata = {
  title: "Ethical Use Charter",
  description: "Mandatory ethical conduct rules, scope restrictions, and legal boundaries for CyberBLADE operators.",
};

export default function EthicalUsePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 print:py-4 print:text-black">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-mono text-xs text-cyan hover:underline print:hidden"
        >
          ‹ RETURN TO CYBERBLADE
        </Link>
      </div>

      <header className="border-b border-line pb-6 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted mb-2">
          <span>DOC: OPSEC-CHARTER-01</span>
          <span>LAST UPDATED: OCTOBER 2026</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-ink tracking-tight">
          ETHICAL USE CHARTER
        </h1>
        <p className="mt-2 text-sm text-secondary font-sans leading-relaxed">
          Binding terms of operational authorization, legal restrictions, and safety protocols for all registered learners and security operators.
        </p>
      </header>

      <article className="prose prose-invert max-w-none space-y-6">
        <EthicalUseAgreement />

        <div className="mt-12 border-t border-line pt-6 text-xs text-muted font-sans space-y-2">
          <p>
            <strong>Security Inquiries & Vulnerability Disclosures:</strong> If you identify a security vulnerability in the CyberBLADE platform itself, please follow our coordinated disclosure policy documented at{" "}
            <a href="/.well-known/security.txt" className="text-cyan underline">
              /.well-known/security.txt
            </a>
            .
          </p>
        </div>
      </article>
    </main>
  );
}

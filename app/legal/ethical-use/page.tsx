import type { Metadata } from "next";
import { EthicalUseAgreement } from "@/components/legal/EthicalUseAgreement";

export const metadata: Metadata = { title: "Ethical use agreement" };

export default function EthicalUsePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-5xl">ethical_use_</h1>
      <EthicalUseAgreement />
    </main>
  );
}

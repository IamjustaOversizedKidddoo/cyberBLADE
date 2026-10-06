import type { Metadata } from "next";
import { HeroBand } from "@/components/theme/HeroBand";
import { TerminalPanel } from "@/components/theme/TerminalPanel";
import { safeNextPath } from "@/lib/identity/routes";
import { StartForm } from "./StartForm";

export const metadata: Metadata = { title: "Start" };

export default async function StartPage(props: PageProps<"/start">) {
  const { next } = await props.searchParams;
  return (
    <main>
      <HeroBand title="initiate_" kicker="> new operator detected" />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <TerminalPanel title="register_operator">
          <StartForm next={safeNextPath(typeof next === "string" ? next : null)} />
        </TerminalPanel>
      </div>
    </main>
  );
}

import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";

export default function NotFound() {
  return (
    <main>
      <HeroBand title="404_not_found" kicker="> no such path on this machine">
        <p>The page you asked for doesn&apos;t exist — or it moved.</p>
      </HeroBand>
      <div className="mx-auto flex max-w-3xl flex-wrap gap-3 px-4 py-12">
        <Link href="/dashboard" className="border border-cyan px-5 py-2 font-ui text-cyan hover:bg-cyan hover:text-void">
          Go to the dashboard
        </Link>
        <Link href="/learn/core" className="neon-toggle self-center">
          rank_map
        </Link>
      </div>
    </main>
  );
}

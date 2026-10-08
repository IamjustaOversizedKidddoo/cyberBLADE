import Link from "next/link";
import { BladeMark } from "@/components/art/BladeMark";
import { BlinkCursor } from "@/components/theme/BlinkCursor";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-6 text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-ui">
          <BladeMark className="h-6 w-6" />
          {BRAND.name}
          <BlinkCursor />
        </span>
        <span>
          <a
            href="https://hackedfont.com"
            className="underline hover:text-cyan"
          >
            Hacked font by David Libeau
          </a>
          {" · "}
          <Link href="/credits" className="underline hover:text-cyan">
            Credits
          </Link>
        </span>
      </div>
    </footer>
  );
}

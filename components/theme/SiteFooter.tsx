import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-6 text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <span className="font-ui">{BRAND.name}_</span>
        <span>
          <a href="https://hackedfont.com" className="underline hover:text-cyan">
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

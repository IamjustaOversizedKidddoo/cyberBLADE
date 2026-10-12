"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "[DASHBOARD]", exact: true },
  { href: "/learn/core", label: "[CURRICULUM]" },
  { href: "/labs", label: "[LABS]" },
  { href: "/exam", label: "[EXAM PREP]" },
];

export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  if (mobile) {
    return (
      <div className="flex md:hidden items-center justify-around border-t border-line/60 bg-surface-subtle px-1 py-1 font-ui text-[11px] tracking-wider text-muted overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? "true" : undefined}
              className={`px-1 py-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${
                active
                  ? "text-cyan font-bold border-b-2 border-cyan -mb-px"
                  : "hover:text-cyan text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 font-ui text-xs tracking-wider">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            className={`px-3 py-1.5 rounded-xs transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
              active
                ? "border-cyan/50 bg-cyan/10 text-cyan font-semibold shadow-[0_0_10px_rgba(15,190,255,0.2)]"
                : "border-transparent text-muted hover:text-ink hover:border-line hover:bg-surface"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

// components/site-navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = useMemo(() => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }, [pathname, href]);

  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-red-600/20 text-red-200"
          : "text-slate-300 hover:text-white hover:bg-slate-700/40"
      }`}
    >
      {label}
    </Link>
  );
}

export default function SiteNavbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        {/* Logo (swap src if you have a file in /public) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt="Black Truth TV"
            className="h-7 w-7 rounded bg-slate-800 object-cover"
          />
          <span className="text-white font-bold tracking-wide">Black Truth TV</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <NavLink href="/" label="Home" />
          <NavLink href="/guide" label="Guide" />
        </nav>
      </div>
    </header>
  );
}

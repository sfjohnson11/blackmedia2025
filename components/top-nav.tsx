// components/top-nav.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const BRAND_NAME = "Black Truth TV";
const BRAND_LOGO_URL =
  "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/brand/blacktruth1.jpeg";

export default function TopNav({
  channelName,
  logoSrc,
}: {
  channelName?: string;
  logoSrc?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const finalLogo = (logoSrc && logoSrc.trim()) || BRAND_LOGO_URL;

  const isActive = useMemo(
    () => (href: string) =>
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(href + "/"),
    [pathname]
  );

  const dim = "text-white/70 hover:text-white/90";
  const active = "text-white";
  const freedom = "text-emerald-400 hover:text-emerald-300 font-semibold";
  const freedomActive = "text-emerald-300 font-semibold";

  return (
    <header className="sticky top-0 z-50 bg-black/70 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md overflow-hidden ring-1 ring-white/10 bg-black/30 grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={finalLogo}
                alt={`${BRAND_NAME} Logo`}
                className="h-full w-full object-contain"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).style.display = "none")
                }
              />
            </div>
            <div className="leading-tight">
              <div className="text-white font-extrabold tracking-tight text-sm sm:text-base">
                {BRAND_NAME}
              </div>
              {channelName ? (
                <div className="text-[10px] sm:text-xs text-white/70">{channelName}</div>
              ) : null}
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/" className={isActive("/") ? active : dim}>Home</Link>
            <Link href="/guide" className={isActive("/guide") ? active : dim}>Guide</Link>
            <Link href="/channels" className={isActive("/channels") ? active : dim}>Channels</Link>
            <Link
              href="/freedom-school"
              className={isActive("/freedom-school") ? freedomActive : freedom}
            >
              Freedom School
            </Link>
            <Link href="/about" className={isActive("/about") ? active : dim}>About</Link>
            <Link href="/contact" className={isActive("/contact") ? active : dim}>Contact</Link>
            <Link
              href="/donate"
              className="hover:text-black bg-amber-300 text-black px-3 py-1 rounded-full font-semibold"
            >
              Donate
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-white/20 text-white/80"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile nav */}
        {open && (
          <div className="md:hidden pb-3">
            <nav className="grid gap-2 text-sm">
              <Link onClick={() => setOpen(false)} href="/" className={`px-1 py-1.5 ${isActive("/") ? active : "text-white/80 hover:text-white"}`}>Home</Link>
              <Link onClick={() => setOpen(false)} href="/guide" className={`px-1 py-1.5 ${isActive("/guide") ? active : "text-white/80 hover:text-white"}`}>Guide</Link>
              <Link onClick={() => setOpen(false)} href="/channels" className={`px-1 py-1.5 ${isActive("/channels") ? active : "text-white/80 hover:text-white"}`}>Channels</Link>
              <Link
                onClick={() => setOpen(false)}
                href="/freedom-school"
                className={`px-1 py-1.5 ${isActive("/freedom-school") ? freedomActive : freedom}`}
              >
                Freedom School
              </Link>
              <Link onClick={() => setOpen(false)} href="/about" className={`px-1 py-1.5 ${isActive("/about") ? active : "text-white/80 hover:text-white"}`}>About</Link>
              <Link onClick={() => setOpen(false)} href="/contact" className={`px-1 py-1.5 ${isActive("/contact") ? active : "text-white/80 hover:text-white"}`}>Contact</Link>
              <Link
                onClick={() => setOpen(false)}
                href="/donate"
                className="mt-1 inline-flex w-max items-center rounded-full bg-amber-300 px-3 py-1 text-black font-semibold"
              >
                Donate
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

// components/top-nav.tsx
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const BRAND_NAME = "Black Truth TV";
const DEFAULT_PUBLIC_LOGO = "/brand/blacktruth-logo.png"; // put your logo in public/brand/blacktruth-logo.png

export default function TopNav({
  channelName,
  logoSrc,
  showBack = false,
}: {
  channelName?: string;
  logoSrc?: string;
  showBack?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-black/40 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <Link
                href="/"
                className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Go home"
              >
                <ChevronLeft className="h-6 w-6" />
              </Link>
            ) : null}

            <Link href="/" className="flex items-center gap-2">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md overflow-hidden ring-1 ring-white/10 flex items-center justify-center bg-black/30">
                <img
                  src={logoSrc || DEFAULT_PUBLIC_LOGO}
                  alt="Black Truth TV Logo"
                  className="h-full w-full object-contain"
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
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/" className="hover:text-white/90 text-white/70">Home</Link>
            <Link href="/guide" className="hover:text-white/90 text-white/70">Guide</Link>
            <Link href="/channels" className="hover:text-white/90 text-white/70">Channels</Link>
            <Link href="/about" className="hover:text-white/90 text-white/70">About</Link>
            <Link href="/contact" className="hover:text-white/90 text-white/70">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/donate"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold
                         text-black bg-amber-300 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400
                         shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_1px_12px_rgba(0,0,0,0.35)]"
            >
              Donate
            </Link>
          </div>
        </div>

        {/* Mobile quick links */}
        <div className="md:hidden py-2 flex items-center justify-center gap-5 text-xs border-t border-white/10">
          <Link href="/guide" className="hover:text-white text-white/80">Guide</Link>
          <Link href="/channels" className="hover:text-white text-white/80">Channels</Link>
          <Link href="/about" className="hover:text-white text-white/80">About</Link>
          <Link href="/contact" className="hover:text-white text-white/80">Contact</Link>
        </div>
      </div>
    </header>
  );
}

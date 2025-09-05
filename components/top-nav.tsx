// components/top-nav.tsx
"use client";

import Link from "next/link";

/** ⬇️ Set these if your bucket/key differ */
const BRAND_BUCKET = "brand";                  // your public bucket name
const BRAND_KEY = "blacktruth-logo.png";       // object path inside the bucket
const BRAND_NAME = "Black Truth TV";

/** Build public storage URL without needing any imports */
const SUPABASE_ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const BRAND_PUBLIC_URL = SUPABASE_ROOT
  ? `${SUPABASE_ROOT}/storage/v1/object/public/${BRAND_BUCKET}/${BRAND_KEY}`
  : undefined;

export default function TopNav({
  channelName,
  logoSrc, // optional manual override
}: {
  channelName?: string;
  logoSrc?: string;
}) {
  // prefer explicit prop → brand bucket URL → local fallback
  const finalLogo =
    (logoSrc && logoSrc.trim()) ||
    BRAND_PUBLIC_URL ||
    "/brand/blacktruth-logo.png"; // optional local fallback in /public/brand

  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-black/40 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md overflow-hidden ring-1 ring-white/10 bg-black/30 flex items-center justify-center">
              {/* plain <img> avoids next/image config hassles */}
              <img
                src={finalLogo}
                alt={`${BRAND_NAME} Logo`}
                className="h-full w-full object-contain"
                onError={(e) => {
                  // hide if broken so text still looks clean
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
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

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/" className="hover:text-white/90 text-white/70">Home</Link>
            <Link href="/guide" className="hover:text-white/90 text-white/70">Guide</Link>
            <Link href="/channels" className="hover:text-white/90 text-white/70">Channels</Link>
            <Link href="/about" className="hover:text-white/90 text-white/70">About</Link>
            <Link href="/contact" className="hover:text-white/90 text-white/70">Contact</Link>
            <Link href="/donate" className="hover:text-black bg-amber-300 text-black px-3 py-1 rounded-full font-semibold">
              Donate
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

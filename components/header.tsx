// components/header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/notification-bell";
import { User } from "lucide-react";

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-black/70 backdrop-blur border-b border-gray-800">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="text-white font-semibold">Black Truth TV</Link>

        <nav className="flex items-center gap-3">
          {/* Example nav links; tweak to match your site */}
          <Link
            href="/watch/21"
            className={`text-sm ${pathname?.startsWith("/watch") ? "text-white" : "text-gray-300"} hover:text-white`}
          >
            Watch
          </Link>
          <Link
            href="/donate"
            className={`text-sm ${pathname === "/donate" ? "text-white" : "text-gray-300"} hover:text-white`}
          >
            Donate
          </Link>

          {/* The ONLY place the bell is rendered */}
          <NotificationBell className="text-white hover:text-gray-300 transition-colors" />

          {/* Profile */}
          <Link href="/profile" className="text-white hover:text-gray-300 transition-colors">
            <User className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

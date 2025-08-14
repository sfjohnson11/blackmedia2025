"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

export default function AdminLoginButton() {
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  // Match your existing admin auth token from /admin/login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("btv_admin_auth");
    setIsAdmin(token === "blacktruth_admin_2025");
  }, [pathname]); // re-check on route change

  // Hide on admin routes and when already logged in
  const isAdminRoute = pathname?.startsWith("/admin");
  if (isAdmin || isAdminRoute) return null;

  return (
    <Link
      href="/admin/login"
      aria-label="Admin Login"
      className="fixed bottom-6 right-6 z-50"
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 shadow-lg transition-colors">
        <Lock className="h-4 w-4" />
        Admin Login
      </span>
    </Link>
  );
}

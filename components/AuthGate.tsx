// components/AuthGate.tsx
"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PUBLIC_ROUTES = ["/login"];

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      setChecking(true);

      // Allow /login without being signed in
      if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
        setChecking(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // ❌ No user → force to /login
      if (!user) {
        router.replace("/login");
        return;
      }

      // ✅ User exists → allow page
      setChecking(false);
    }

    checkAuth();
  }, [pathname, router]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#e5e7eb",
        }}
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}

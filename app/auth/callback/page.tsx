"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();

  // Only allow internal redirects
  const r = params.get("redirect_to");
  const redirectTo = r && r.startsWith("/") ? r : "/";

  useEffect(() => {
    const code = params.get("code");
    if (!code) {
      router.replace("/auth/login");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession({ code });
      if (error) {
        console.error("exchangeCodeForSession error:", error.message);
        router.replace(`/auth/login?error=${encodeURIComponent(error.message)}`);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    })();
  }, [params, router, redirectTo]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-300">Setting up your session…</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <CallbackInner />
    </Suspense>
  );
}

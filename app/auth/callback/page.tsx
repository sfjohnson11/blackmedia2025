"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectTo = sp?.get("redirect_to") || "/";

  useEffect(() => {
    async function run() {
      await supabase.auth.exchangeCodeForSession();
      router.replace(redirectTo);
      router.refresh();
    }
    run();
  }, [router, redirectTo]);

  return <div className="min-h-screen bg-black" />;
}
